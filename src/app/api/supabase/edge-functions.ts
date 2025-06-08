import { createClient } from '@/lib/supabase-clients/server';
/*  */
// Payment Processing
export const processMpesaPayment = async (amount: number, phone: string, store_id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('process-mpesa-payment', {
    body: { amount, phone, store_id },
  });
  return { data, error };
};

export const processCashPayment = async (amount: number, store_id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('process-cash-payment', {
    body: { amount, store_id },
  });
  return { data, error };
};

// Stock Management
export const updateStock = async (product_id: string, quantity: number, store_id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_stock', {
    p_product_id: product_id,
    p_quantity_change: quantity,
    p_store_id: store_id
  });
  return { data, error };
};

export const getStockLevel = async (product_id: string, store_id: string) => {
  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase.rpc('get_stock_level', {
      p_product_id: product_id,
      p_store_id: store_id
    });
    
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (err) {
    throw err;
  }
};

// Sales Processing
export const createSale = async (saleData: {
  store_id: string;
  products: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    vat_amount: number;
    saleMode?: 'retail' | 'wholesale';
    displayPrice?: number;
  }>;
  payment_method: 'cash' | 'mpesa';
  total_amount: number;
  vat_total: number;
}) => {
  const supabase = await createClient();
  
  // First, validate stock levels and store stock data
  const stockDataMap = new Map();
  for (const product of saleData.products) {
    const { data: stockData, error: stockError } = await getStockLevel(
      product.id,
      saleData.store_id
    );
    
    if (stockError) {
      throw new Error(`Failed to check stock: ${String(stockError)}`);
    }
    
    stockDataMap.set(product.id, stockData);
    const currentStock = stockData.quantity;
    const unitsToDeduct = product.quantity;
    
    if (currentStock < unitsToDeduct) {
      throw new Error(`Insufficient stock for product ${product.id}`);
    }
  }

  const mappedProducts = saleData.products.map(p => ({
    product_id: p.id,
    quantity: p.quantity,
    price: p.price,
    vat_amount: p.vat_amount,
    saleMode: p.saleMode || 'retail',
    displayPrice: p.displayPrice || p.price
  }));

  const { data, error } = await supabase.rpc('create_sale', {
    p_store_id: saleData.store_id,
    p_products: mappedProducts,
    p_payment_method: saleData.payment_method,
    p_total_amount: saleData.total_amount,
    p_vat_total: saleData.vat_total
  });

  if (error) {
    throw error;
  }

  return { data, error: null };
};