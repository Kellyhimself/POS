import { useSettings } from '@/components/providers/SettingsProvider';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import { useState, useEffect } from 'react';

export function useVatSettings() {
  const { settings } = useSettings();
  const { user } = useSimplifiedAuth();
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

  // Calculate price to display/charge to customer
  const calculatePrice = (basePrice: number, isVatable: boolean) => {
    // Safety check for invalid basePrice
    if (typeof basePrice !== 'number' || isNaN(basePrice)) {
      console.warn('⚠️ Invalid basePrice provided to calculatePrice:', basePrice);
      return 0;
    }

    if (!settings) {
      console.log('📱 No settings available, returning base price:', basePrice);
      return basePrice;
    }

    // If VAT is disabled
    if (!isVatEnabled || !isVatable) {
      if (settings.vat_pricing_model === 'inclusive') {
        // Price is stored inclusive of VAT, so deduct VAT for display
        const vatRate = settings.default_vat_rate || 16;
        return basePrice / (1 + vatRate / 100);
      } else {
        // Price is stored exclusive of VAT, so return as-is
        return basePrice;
      }
    }

    // If VAT is enabled
    if (settings.vat_pricing_model === 'inclusive') {
      // Price is stored inclusive of VAT, so return as-is
      return basePrice;
    } else {
      // Price is stored exclusive of VAT, so add VAT
      const vatRate = settings.default_vat_rate || 16;
      return basePrice * (1 + vatRate / 100);
    }
  };

  // Calculate VAT amount for the given price
  const calculateVatAmount = (price: number, isVatable: boolean) => {
    // Safety check for invalid price
    if (typeof price !== 'number' || isNaN(price)) {
      console.warn('⚠️ Invalid price provided to calculateVatAmount:', price);
      return 0;
    }

    if (!settings || !isVatEnabled || !isVatable) return 0;

    const vatRate = settings.default_vat_rate || 16;

    if (settings.vat_pricing_model === 'inclusive') {
      // Extract VAT from inclusive price
      const baseAmount = price / (1 + vatRate / 100);
      return price - baseAmount;
    } else {
      // Calculate VAT for exclusive price
      return price * (vatRate / 100);
    }
  };

  // Get base price (without VAT) - used for accounting purposes
  const getBasePrice = (price: number, isVatable: boolean) => {
    // Safety check for invalid price
    if (typeof price !== 'number' || isNaN(price)) {
      console.warn('⚠️ Invalid price provided to getBasePrice:', price);
      return 0;
    }

    if (!settings || !isVatEnabled || !isVatable) return price;

    const vatRate = settings.default_vat_rate || 16;

    if (settings.vat_pricing_model === 'inclusive') {
      // Extract base price from inclusive price
      return price / (1 + vatRate / 100);
    } else {
      // Price is already base price
      return price;
    }
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
    const canToggle = settings?.enable_vat_toggle_on_pos && user?.user_metadata?.role === 'admin';
    console.log('🔐 Can toggle VAT:', canToggle, {
      enableVatToggle: settings?.enable_vat_toggle_on_pos,
      userRole: user?.user_metadata?.role
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
    calculateVatAmount,
    getBasePrice
  };
} 