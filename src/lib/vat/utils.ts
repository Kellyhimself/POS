import { useVatSettings } from '@/hooks/useVatSettings';

export interface VatCalculation {
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export const calculateVAT = (amount: number, vatStatus: boolean, settings: { vat_pricing_model: 'inclusive' | 'exclusive', default_vat_rate: number }, isVatEnabled: boolean = true): VatCalculation => {
  if (!vatStatus || !isVatEnabled) {
    return {
      taxableAmount: amount,
      vatAmount: 0,
      totalAmount: amount
    };
  }
  
  const vatRate = settings.default_vat_rate / 100;
  
  if (settings.vat_pricing_model === 'inclusive') {
    const taxableAmount = amount / (1 + vatRate);
    const vatAmount = amount - taxableAmount;
    return {
      taxableAmount,
      vatAmount,
      totalAmount: amount
    };
  } else {
    const vatAmount = amount * vatRate;
    return {
      taxableAmount: amount,
      vatAmount,
      totalAmount: amount + vatAmount
    };
  }
};

// Calculate price to display/charge to customer
export const calculatePrice = (basePrice: number, isVatable: boolean, settings: { vat_pricing_model: 'inclusive' | 'exclusive', default_vat_rate: number }, isVatEnabled: boolean = true): number => {
  if (!isVatEnabled || !isVatable) {
    if (settings.vat_pricing_model === 'inclusive') {
      // Price is stored inclusive of VAT, so deduct VAT for display
      return basePrice / (1 + settings.default_vat_rate / 100);
    } else {
      // Price is stored exclusive of VAT, so return as-is
      return basePrice;
    }
  }

  if (settings.vat_pricing_model === 'inclusive') {
    return basePrice; // Price already includes VAT
  } else {
    return basePrice * (1 + settings.default_vat_rate / 100); // Add VAT to base price
  }
};

// Calculate VAT amount for the given price
export const calculateVatAmount = (price: number, isVatable: boolean, settings: { vat_pricing_model: 'inclusive' | 'exclusive', default_vat_rate: number }, isVatEnabled: boolean = true): number => {
  if (!isVatEnabled || !isVatable) return 0;

  if (settings.vat_pricing_model === 'inclusive') {
    const baseAmount = price / (1 + settings.default_vat_rate / 100);
    return price - baseAmount; // Extract VAT from inclusive price
  } else {
    return price * (settings.default_vat_rate / 100); // Calculate VAT for exclusive price
  }
};

// Get base price (without VAT) - used for accounting purposes
export const getBasePrice = (price: number, isVatable: boolean, settings: { vat_pricing_model: 'inclusive' | 'exclusive', default_vat_rate: number }, isVatEnabled: boolean = true): number => {
  if (!isVatEnabled || !isVatable) return price;

  if (settings.vat_pricing_model === 'inclusive') {
    return price / (1 + settings.default_vat_rate / 100); // Extract base from inclusive price
  } else {
    return price; // Price is already base price
  }
};

export const removeVAT = (totalAmount: number, vatRate: number): number => {
  return totalAmount / (1 + vatRate / 100);
};

export const addVAT = (amount: number, vatRate: number): number => {
  return amount * (1 + vatRate / 100);
};

export const formatVatStatus = (vatStatus: boolean): 'VATABLE' | 'EXEMPT' => {
  return vatStatus ? 'VATABLE' : 'EXEMPT';
};

// Test function to verify VAT calculations
export const testVatCalculations = () => {
  const settings = {
    vat_pricing_model: 'inclusive' as const,
    default_vat_rate: 16
  };

  console.log('🧪 Testing VAT Calculations:');
  
  // Test 1: VAT ON - Inclusive Mode
  const price1 = calculatePrice(116, true, settings, true);
  console.log('VAT ON - Inclusive (116):', price1); // Should be 116
  
  // Test 2: VAT OFF - Inclusive Mode
  const price2 = calculatePrice(116, true, settings, false);
  console.log('VAT OFF - Inclusive (116):', price2); // Should be 100
  
  // Test 3: VAT ON - Exclusive Mode
  const settings2 = { vat_pricing_model: 'exclusive' as const, default_vat_rate: 16 };
  const price3 = calculatePrice(100, true, settings2, true);
  console.log('VAT ON - Exclusive (100):', price3); // Should be 116
  
  // Test 4: VAT OFF - Exclusive Mode
  const price4 = calculatePrice(100, true, settings2, false);
  console.log('VAT OFF - Exclusive (100):', price4); // Should be 100
}; 