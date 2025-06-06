import { Database } from '@/types/supabase';
import { createClient } from '@/lib/supabase-clients/server';

type Product = Database['public']['Tables']['products']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];

export interface EtimsInvoice {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_tax_pin: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_amount: number;
  }>;
  total_amount: number;
  vat_total: number;
  store_id: string;
}

export const generateInvoiceNumber = (storeId: string, timestamp: string): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${storeId.slice(0, 4)}-${year}${month}${day}-${random}`;
};

export const calculateVATAmount = (amount: number, vatStatus: boolean): number => {
  if (!vatStatus) return 0;
  return amount * 0.16; // 16% VAT rate
};

export const formatEtimsInvoice = (
  transaction: Transaction,
  products: Product[],
  storeId: string
): EtimsInvoice => {
  const invoiceNumber = generateInvoiceNumber(storeId, transaction.timestamp || new Date().toISOString());
  
  return {
    invoice_number: invoiceNumber,
    date: transaction.timestamp || new Date().toISOString(),
    customer_name: 'Walk-in Customer',
    customer_tax_pin: '000000000',
    items: products.map(product => ({
      description: product.name,
      quantity: transaction.quantity,
      unit_price: product.selling_price,
      vat_amount: calculateVATAmount(product.selling_price * transaction.quantity, product.vat_status || false)
    })),
    total_amount: transaction.total,
    vat_total: transaction.vat_amount || 0,
    store_id: storeId
  };
};

export const validateEtimsInvoice = (invoice: EtimsInvoice): string[] => {
  const errors: string[] = [];

  if (!invoice.invoice_number) errors.push('Invoice number is required');
  if (!invoice.date) errors.push('Date is required');
  if (!invoice.customer_name) errors.push('Customer name is required');
  if (!invoice.customer_tax_pin) errors.push('Customer tax PIN is required');
  if (!invoice.items.length) errors.push('At least one item is required');
  if (invoice.total_amount <= 0) errors.push('Total amount must be greater than 0');
  if (invoice.vat_total < 0) errors.push('VAT total cannot be negative');
  if (!invoice.store_id) errors.push('Store ID is required');

  return errors;
}; 


export const submitEtimsInvoice = async (invoiceData: {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_tax_pin: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_amount: number;
  }>;
  total_amount: number;
  vat_total: number;
  store_id: string;
}) => {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('submit-etims-invoice', {
    body: { invoiceData, store_id: invoiceData.store_id },
  });
  return { data, error };
}; 