import { useSettings } from '@/components/providers/SettingsProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { useState, useEffect } from 'react';

interface VatSettings {
  enableVatToggle: boolean;
  vatPricingModel: 'inclusive' | 'exclusive';
  defaultVatRate: number;
  isVatEnabled: boolean;
}

export function useVatSettings() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [isVatEnabled, setIsVatEnabled] = useState(false);

  // Initialize isVatEnabled based on settings
  useEffect(() => {
    if (settings) {
      console.log('🔄 VAT Settings updated:', settings);
      // If VAT toggle is disabled in settings, force VAT to be disabled
      if (!settings.enable_vat_toggle_on_pos) {
        console.log('📱 VAT toggle disabled in settings, forcing VAT off');
        setIsVatEnabled(false);
      } else {
        // If VAT toggle is enabled in settings, initialize to true
        console.log('✅ VAT toggle enabled in settings, initializing to true');
        setIsVatEnabled(true);
      }
    }
  }, [settings]);

  // Calculate price with/without VAT
  const calculatePrice = (basePrice: number, isVatable: boolean) => {
    if (!settings) return basePrice;

    if (!isVatEnabled || !isVatable) {
      if (settings.vat_pricing_model === 'inclusive') {
        // If price includes VAT, remove it
        return basePrice / (1 + settings.default_vat_rate / 100);
      }
      return basePrice;
    }

    if (settings.vat_pricing_model === 'exclusive') {
      // Add VAT to base price
      return basePrice * (1 + settings.default_vat_rate / 100);
    }

    return basePrice;
  };

  // Calculate VAT amount
  const calculateVatAmount = (price: number, isVatable: boolean) => {
    if (!settings || !isVatEnabled || !isVatable) return 0;

    if (settings.vat_pricing_model === 'inclusive') {
      // Extract VAT from inclusive price
      return price - (price / (1 + settings.default_vat_rate / 100));
    }

    // Calculate VAT for exclusive price
    return price * (settings.default_vat_rate / 100);
  };

  // Toggle VAT for current transaction (only works if global toggle is enabled)
  const toggleVat = () => {
    if (settings?.enable_vat_toggle_on_pos) {
      console.log('🔄 Toggling VAT:', !isVatEnabled);
      setIsVatEnabled(!isVatEnabled);
    } else {
      // If global toggle is disabled, force VAT to be disabled
      console.log('📱 Cannot toggle VAT - disabled in settings');
      setIsVatEnabled(false);
    }
  };

  // Check if user can toggle VAT
  const canToggleVat = () => {
    const canToggle = settings?.enable_vat_toggle_on_pos && user?.role === 'admin';
    console.log('🔐 Can toggle VAT:', canToggle, {
      enableVatToggle: settings?.enable_vat_toggle_on_pos,
      userRole: user?.role
    });
    return canToggle;
  };

  return {
    settings: settings ? {
      enableVatToggle: settings.enable_vat_toggle_on_pos,
      vatPricingModel: settings.vat_pricing_model,
      defaultVatRate: settings.default_vat_rate,
      isVatEnabled: settings.enable_vat_toggle_on_pos
    } : null,
    isVatEnabled,
    toggleVat,
    canToggleVat,
    calculatePrice,
    calculateVatAmount
  };
} 