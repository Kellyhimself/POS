import { useVatSettings } from '@/hooks/useVatSettings';

export interface VatCalculation {
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export const calculateVAT = (amount: number, vatStatus: boolean, settings: { vat_pricing_model: 'inclusive' | 'exclusive', default_vat_rate: number }): VatCalculation => {
  if (!vatStatus) {
    return {
      taxableAmount: 0,
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

export const removeVAT = (totalAmount: number, vatRate: number): number => {
  return totalAmount / (1 + vatRate / 100);
};

export const addVAT = (amount: number, vatRate: number): number => {
  return amount * (1 + vatRate / 100);
};

export const formatVatStatus = (vatStatus: boolean): 'VATABLE' | 'EXEMPT' => {
  return vatStatus ? 'VATABLE' : 'EXEMPT';
}; 