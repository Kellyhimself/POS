export const VAT_RATE = 0.16; // 16% VAT rate

export interface VatCalculation {
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export const calculateVAT = (amount: number, vatStatus: boolean): VatCalculation => {
  if (!vatStatus) {
    return {
      taxableAmount: 0,
      vatAmount: 0,
      totalAmount: amount
    };
  }
  
  const vatAmount = amount * VAT_RATE;
  return {
    taxableAmount: amount,
    vatAmount,
    totalAmount: amount + vatAmount
  };
};

export const removeVAT = (totalAmount: number): number => {
  return totalAmount / (1 + VAT_RATE);
};

export const addVAT = (amount: number): number => {
  return amount * (1 + VAT_RATE);
};

export const formatVatStatus = (vatStatus: boolean): 'VATABLE' | 'EXEMPT' => {
  return vatStatus ? 'VATABLE' : 'EXEMPT';
}; 