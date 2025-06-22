import Dexie, { Table } from 'dexie';
import { Database } from '@/types/supabase';

// Define extended types for offline database
type OfflineProduct = Database['public']['Tables']['products']['Row'] & { 
  synced: boolean; 
  created_at?: string;
  barcode?: string | null;
};
type OfflineTransaction = {
    id: string;
    store_id: string;
    payment_method: string;
    total_amount: number;
    vat_total: number;
    timestamp: string;
    synced: boolean;
    created_at: string;
};
type OfflineSaleItem = {
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    price: number;
    vat_amount: number;
    sale_mode: 'retail' | 'wholesale';
    timestamp: string;
    created_at: string;
};
type OfflineEtimsSubmission = Database['public']['Tables']['etims_submissions']['Row'] & { synced: boolean };
type OfflineStockUpdate = {
    id: string;
    product_id: string;
    quantity_change: number;
    store_id: string;
    created_at: string;
    synced: boolean;
};

// Add types for offline purchases
export type OfflinePurchase = Database['public']['Tables']['purchases']['Row'] & { synced: boolean; supplier_name?: string };
export type OfflinePurchaseItem = Database['public']['Tables']['purchase_items']['Row'] & { synced: boolean };

// Add types for offline suppliers
export type OfflineSupplier = Database['public']['Tables']['suppliers']['Row'] & { synced: boolean };

// Add type for offline app settings
type OfflineAppSettings = {
  id: string; // always 'global'
  enable_vat_toggle_on_pos: boolean;
  vat_pricing_model: 'inclusive' | 'exclusive';
  default_vat_rate: number;
  enable_etims_integration: boolean;
  // Cost protection settings
  cost_protection_enabled?: boolean;
  cost_protection_admin_approval?: boolean;
  cost_protection_allow_below_cost?: boolean;
  cost_protection_min_margin?: number;
  cost_protection_show_warnings?: boolean;
  cost_protection_auto_calculate?: boolean;
  // Receipt settings
  receipt_auto_print?: boolean;
  receipt_auto_download?: boolean;
  receipt_download_format?: 'pdf' | 'txt' | 'both';
  receipt_print_delay?: number;
  receipt_download_delay?: number;
  receipt_show_inline?: boolean;
  receipt_auto_close?: boolean;
  receipt_close_delay?: number;
  synced: boolean;
  updated_at: string;
};

export class OfflineDB extends Dexie {
  products!: Table<OfflineProduct>;
  stores!: Table<Database['public']['Tables']['stores']['Row']>;
  transactions!: Table<OfflineTransaction>;
  sale_items!: Table<OfflineSaleItem>;
  etims_submissions!: Table<OfflineEtimsSubmission>;
  users!: Table<Database['public']['Tables']['users']['Row']>;
  stock_updates!: Table<OfflineStockUpdate>;
  purchases!: Table<OfflinePurchase>;
  purchase_items!: Table<OfflinePurchaseItem>;
  suppliers!: Table<OfflineSupplier>;
  app_settings!: Table<OfflineAppSettings>;

  constructor() {
    super('OfflineDB');
    this.version(7).stores({
      products: 'id, store_id, name, sku, category, parent_product_id, barcode, synced, created_at',
      stores: 'id, name, address, kra_pin, vat_number, etims_username, etims_password, kra_token, mpesa_details',
      transactions: 'id, store_id, payment_method, total_amount, vat_total, timestamp, synced, created_at',
      sale_items: 'id, sale_id, product_id, quantity, price, vat_amount, sale_mode, timestamp, created_at',
      etims_submissions: 'id, store_id, invoice_number, data, status, submitted_at, synced, created_at, submission_type',
      users: 'id, store_id, role',
      stock_updates: 'id, product_id, quantity_change, store_id, synced, created_at',
      purchases: 'id, store_id, supplier_id, invoice_number, synced, created_at',
      purchase_items: 'id, purchase_id, product_id, synced, created_at',
      suppliers: 'id, name, vat_no, contact_info, synced, created_at',
      app_settings: 'id',
    }).upgrade(dbtx => {
      return Promise.all([
        dbtx.table('products').toCollection().modify((product: OfflineProduct) => {
          if (!product.created_at) {
            product.created_at = new Date().toISOString();
          }
          // Add barcode field if it doesn't exist
          if (!('barcode' in product)) {
            (product as OfflineProduct).barcode = null;
          }
          // Ensure synced field is a valid boolean
          if (product.synced === null || product.synced === undefined) {
            product.synced = false;
          }
        }),
        dbtx.table('transactions').toCollection().modify((transaction: OfflineTransaction) => {
          if (!transaction.created_at) {
            transaction.created_at = new Date().toISOString();
          }
          // Ensure synced field is a valid boolean
          if (transaction.synced === null || transaction.synced === undefined) {
            transaction.synced = false;
          }
        }),
        dbtx.table('sale_items').toCollection().modify((item: OfflineSaleItem) => {
          if (!item.created_at) {
            item.created_at = new Date().toISOString();
          }
        }),
        dbtx.table('stock_updates').toCollection().modify((update: OfflineStockUpdate) => {
          if (!update.created_at) {
            update.created_at = new Date().toISOString();
          }
          // Ensure synced field is a valid boolean
          if (update.synced === null || update.synced === undefined) {
            update.synced = false;
          }
        }),
        dbtx.table('etims_submissions').toCollection().modify((submission: OfflineEtimsSubmission) => {
          if (!submission.created_at) {
            submission.created_at = new Date().toISOString();
          }
          // Ensure synced field is a valid boolean
          if (submission.synced === null || submission.synced === undefined) {
            submission.synced = false;
          }
        }),
        dbtx.table('purchases').toCollection().modify((purchase: OfflinePurchase) => {
          // Ensure synced field is a valid boolean
          if (purchase.synced === null || purchase.synced === undefined) {
            purchase.synced = false;
          }
        }),
        dbtx.table('purchase_items').toCollection().modify((item: OfflinePurchaseItem) => {
          // Ensure synced field is a valid boolean
          if (item.synced === null || item.synced === undefined) {
            item.synced = false;
          }
        }),
        dbtx.table('suppliers').toCollection().modify((supplier: OfflineSupplier) => {
          // Ensure synced field is a valid boolean
          if (supplier.synced === null || supplier.synced === undefined) {
            supplier.synced = false;
          }
        }),
        dbtx.table('app_settings').toCollection().modify((settings: OfflineAppSettings) => {
          // Add cost protection settings if they don't exist
          if (!('cost_protection_enabled' in settings)) {
            (settings as OfflineAppSettings).cost_protection_enabled = true;
          }
          if (!('cost_protection_admin_approval' in settings)) {
            (settings as OfflineAppSettings).cost_protection_admin_approval = true;
          }
          if (!('cost_protection_allow_below_cost' in settings)) {
            (settings as OfflineAppSettings).cost_protection_allow_below_cost = false;
          }
          if (!('cost_protection_min_margin' in settings)) {
            (settings as OfflineAppSettings).cost_protection_min_margin = 5;
          }
          if (!('cost_protection_show_warnings' in settings)) {
            (settings as OfflineAppSettings).cost_protection_show_warnings = true;
          }
          if (!('cost_protection_auto_calculate' in settings)) {
            (settings as OfflineAppSettings).cost_protection_auto_calculate = true;
          }
          // Add receipt settings if they don't exist
          if (!('receipt_auto_print' in settings)) {
            (settings as OfflineAppSettings).receipt_auto_print = false;
          }
          if (!('receipt_auto_download' in settings)) {
            (settings as OfflineAppSettings).receipt_auto_download = false;
          }
          if (!('receipt_download_format' in settings)) {
            (settings as OfflineAppSettings).receipt_download_format = 'pdf';
          }
          if (!('receipt_print_delay' in settings)) {
            (settings as OfflineAppSettings).receipt_print_delay = 1000;
          }
          if (!('receipt_download_delay' in settings)) {
            (settings as OfflineAppSettings).receipt_download_delay = 1000;
          }
          if (!('receipt_show_inline' in settings)) {
            (settings as OfflineAppSettings).receipt_show_inline = true;
          }
          if (!('receipt_auto_close' in settings)) {
            (settings as OfflineAppSettings).receipt_auto_close = false;
          }
          if (!('receipt_close_delay' in settings)) {
            (settings as OfflineAppSettings).receipt_close_delay = 3000;
          }
          // Ensure synced field is a valid boolean
          if (settings.synced === null || settings.synced === undefined) {
            settings.synced = false;
          }
        })
      ]);
    });
  }
}

export const db = new OfflineDB();

// Helper functions for offline data management
export async function cacheUser(user: {
  id: string;
  email: string;
  role: string;
  store_id: string;
  encrypted_credentials: string;
  expires_at: Date;
}) {
  await db.users.put({
    id: user.id,
    store_id: user.store_id,
    role: user.role
  });
}

export async function getOfflineUser(userId?: string) {
  if (userId) {
    return await db.users.get(userId);
  }
  // If no userId provided, get the first user from the store
  return await db.users.toArray().then(users => users[0]);
}

export async function cacheProducts(products: Database['public']['Tables']['products']['Row'][]) {
  console.log('🔄 cacheProducts: Caching products:', products.length, 'products');
  // Add synced field to each product
  const offlineProducts = products.map(product => ({
    ...product,
    synced: true
  }));
  await db.products.bulkPut(offlineProducts);
  console.log('✅ cacheProducts: Products cached successfully');
  
  // Verify cache
  const cachedProducts = await db.products.toArray();
  console.log('📊 cacheProducts: Total products in cache:', cachedProducts.length);
}

export async function getCachedProducts(storeId: string) {
  console.log('🔄 getCachedProducts: Fetching products for store:', storeId);
  const products = await db.products.where('store_id').equals(storeId).toArray();
  console.log('✅ getCachedProducts: Retrieved products:', products.length, 'products');
  console.log('📊 getCachedProducts: Product quantities:', 
    products.map(p => ({ id: p.id, name: p.name, quantity: p.quantity, synced: p.synced }))
  );
  return products;
}

export async function cacheTransaction(transaction: Database['public']['Tables']['transactions']['Row']) {
  // Convert to offline transaction format
  const offlineTransaction: OfflineTransaction = {
    id: transaction.id,
    store_id: transaction.store_id || '',
    payment_method: transaction.payment_method || '',
    total_amount: transaction.total,
    vat_total: transaction.vat_amount || 0,
    timestamp: transaction.timestamp || new Date().toISOString(),
    synced: transaction.synced || false,
    created_at: new Date().toISOString()
  };
  await db.transactions.put(offlineTransaction);
}

export async function getPendingTransactions(storeId: string) {
  return await db.transactions
    .where('store_id')
    .equals(storeId)
    .and(transaction => transaction.synced === false)
    .toArray();
}

export async function cacheETIMSSubmission(submission: Database['public']['Tables']['etims_submissions']['Row']) {
  // Add synced field to submission
  const offlineSubmission: OfflineEtimsSubmission = {
    ...submission,
    synced: false
  };
  await db.etims_submissions.put(offlineSubmission);
}

export async function getPendingETIMSSubmissions(storeId: string) {
  console.log('🔍 Fetching pending eTIMS submissions from IndexedDB:', { storeId });
  
  try {
    const submissions = await db.etims_submissions
      .where('store_id')
      .equals(storeId)
      .and(submission => submission.status === 'pending')
      .toArray();

    console.log('📊 Retrieved pending eTIMS submissions:', {
      count: submissions.length,
      submissions: submissions.map(s => ({
        id: s.id,
        invoice_number: s.invoice_number,
        store_id: s.store_id,
        status: s.status,
        submitted_at: s.submitted_at
      }))
    });

    return submissions;
  } catch (error) {
    console.error('❌ Error fetching pending eTIMS submissions:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
    throw error;
  }
}

export async function updateETIMSSubmissionStatus(id: string, status: string, responseData?: Database['public']['Tables']['etims_submissions']['Row']['response_data'], errorMessage?: string) {
  await db.etims_submissions.update(id, {
    status,
    response_data: responseData,
    error_message: errorMessage,
    updated_at: new Date().toISOString()
  });
}

export async function markTransactionAsSynced(id: string) {
  await db.transactions.update(id, { synced: true });
}

export async function clearOfflineData() {
  try {
    console.log('🧹 Clearing all offline data...');
    
    // Clear all tables
    await Promise.all([
      db.transactions.clear(),
      db.sale_items.clear(),
      db.stock_updates.clear(),
      db.etims_submissions.clear(),
      db.products.clear()
    ]);

    console.log('✅ All offline data cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing offline data:', error);
    throw error;
  }
}

export async function validateOfflineUser() {
  const user = await getOfflineUser();
  if (!user) return null;

  // Check if the user's store exists
  const store = await db.stores.get(user.store_id || '');
  if (!store) return null;

  return {
    id: user.id,
    store_id: user.store_id,
    role: user.role,
    store
  };
}

interface SaleInput {
  store_id: string;
  products: Array<{
    id: string;
    quantity: number;
    displayPrice: number;
    vat_amount: number;
  }>;
  payment_method: 'cash' | 'mobile_money' | 'credit';
  total_amount: number;
  vat_total: number;
  timestamp?: string;
}

export async function saveOfflineSale(sale: SaleInput) {
  const saleId = crypto.randomUUID();
  
  // Create timestamp in Kenya timezone
  const keTime = new Date();
  const timestamp = keTime.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' });
  // Create a new date object in Kenya timezone
  const keDate = new Date(timestamp);
  // Format to ISO string while preserving the timezone offset
  const timestampISO = keDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' });

  // Ensure sale has a timestamp
  const saleWithTimestamp = {
    ...sale,
    timestamp: sale.timestamp || timestampISO
  };

  

  // Create the sale record
  const saleRecord: OfflineTransaction = {
    id: saleId,
    store_id: saleWithTimestamp.store_id,
    payment_method: saleWithTimestamp.payment_method,
    total_amount: saleWithTimestamp.total_amount,
    vat_total: saleWithTimestamp.vat_total,
    timestamp: saleWithTimestamp.timestamp,
    created_at: timestampISO,
    synced: false
  };

  // Create sale items
  const saleItems: OfflineSaleItem[] = sale.products.map(product => {
    // Debug logging for VAT storage
    console.log('💾 VAT Storage Debug - Product:', {
      product_id: product.id,
      quantity: product.quantity,
      vat_amount_being_stored: product.vat_amount,
      note: 'This should be VAT per unit'
    });
    
    return {
      id: crypto.randomUUID(),
      sale_id: saleId,
      product_id: product.id,
      quantity: product.quantity,
      price: product.displayPrice,
      vat_amount: product.vat_amount,
      sale_mode: 'retail' as const,
      timestamp: timestampISO,
      created_at: timestampISO
    };
  });

  // Use a transaction that includes all object stores we're modifying
  await db.transaction('rw', [db.transactions, db.sale_items, db.products], async () => {
    // Save the sale record
    await db.transactions.put(saleRecord);
    
    // Save all sale items
    await Promise.all(saleItems.map(item => db.sale_items.put(item)));

    // Update local stock
    for (const product of sale.products) {
      const currentProduct = await db.products.get(product.id);
      console.log('📊 Current product before update:', {
        product_id: product.id,
        current_quantity: currentProduct?.quantity,
        sale_quantity: product.quantity
      });

      if (currentProduct) {
        const newQuantity = Math.max(0, (currentProduct.quantity || 0) - product.quantity);
        console.log('📊 Updating product quantity:', {
          product_id: product.id,
          old_quantity: currentProduct.quantity,
          sale_quantity: product.quantity,
          new_quantity: newQuantity
        });

        await db.products.put({
          ...currentProduct,
          quantity: newQuantity,
          synced: false
        });

        // Verify the update
        const updatedProduct = await db.products.get(product.id);
        console.log('📊 Product after update:', {
          product_id: product.id,
          new_quantity: updatedProduct?.quantity,
          synced: updatedProduct?.synced
        });
      } else {
        console.error('❌ Product not found in local DB:', {
          product_id: product.id
        });
      }
    }
  });

  // Get final state of products
  const finalProducts = await db.products
    .where('id')
    .anyOf(sale.products.map(p => p.id))
    .toArray();

  console.log('📊 Final product quantities:', {
    products: finalProducts.map(p => ({
      id: p.id,
      quantity: p.quantity
    }))
  });

  return {
    id: saleId,
    store_id: sale.store_id,
    payment_method: sale.payment_method,
    total_amount: sale.total_amount,
    vat_total: sale.vat_total,
    timestamp: timestampISO,
    created_at: timestampISO,
    synced: false,
    items: saleItems
  };
}

export async function saveOfflineStockUpdate(update: { product_id: string; store_id: string; quantity_change: number }) {
  const product = await db.products.get(update.product_id);
  if (product) {
    await db.products.update(update.product_id, {
      quantity: (product.quantity || 0) + update.quantity_change
    });
  }
  return update;
}

export async function saveOfflineETIMSSubmission(submission: Omit<Database['public']['Tables']['etims_submissions']['Insert'], 'id' | 'created_at' | 'updated_at' | 'response_data' | 'error_message'>) {
  console.log('💾 Saving eTIMS submission to IndexedDB:', {
    invoice_number: submission.invoice_number,
    store_id: submission.store_id,
    status: submission.status,
    submission_type: submission.submission_type
  });

  const offlineSubmission: OfflineEtimsSubmission = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    error_message: null,
    invoice_number: submission.invoice_number,
    response_data: null,
    status: submission.status,
    store_id: submission.store_id,
    submitted_at: submission.submitted_at,
    updated_at: new Date().toISOString(),
    submission_type: submission.submission_type || 'output_vat',
    synced: false
  };
  
  try {
    await db.etims_submissions.put(offlineSubmission);
    console.log('✅ eTIMS submission saved to IndexedDB:', {
      id: offlineSubmission.id,
      invoice_number: offlineSubmission.invoice_number,
      status: offlineSubmission.status,
      submission_type: offlineSubmission.submission_type
    });
    return offlineSubmission;
  } catch (error) {
    console.error('❌ Error saving eTIMS submission to IndexedDB:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      invoice_number: submission.invoice_number,
      store_id: submission.store_id
    });
    throw error;
  }
}

export async function processSyncQueue() {
  console.log('🔄 Processing sync queue...');
  
  // Get all pending transactions using filter instead of equals
  const pendingTransactions = await db.transactions
    .filter(transaction => transaction.synced === false)
    .toArray();

  console.log(`📦 Found ${pendingTransactions.length} pending transactions:`, 
    pendingTransactions.map(t => ({
      id: t.id,
      store_id: t.store_id,
      total_amount: t.total_amount,
      synced: t.synced
    }))
  );

  // Get all pending ETIMS submissions
  const pendingETIMS = await db.etims_submissions
    .where('status')
    .equals('pending')
    .toArray();

  console.log(`📦 Found ${pendingETIMS.length} pending ETIMS submissions`);

  return {
    pendingTransactions,
    pendingETIMS
  };
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number;
  vat_status: boolean;
  category: string | null;
  cost_price: number;
}

interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price: number;
  vat_amount: number;
  sale_mode: 'retail' | 'wholesale';
}

interface Transaction {
  id: string;
  store_id: string;
  timestamp: string;
  payment_method: string;
  total_amount: number;
}

interface TransactionWithProduct {
  id: string;
  product_id: string;
  quantity: number;
  total: number;
  vat_amount: number;
  payment_method: string;
  timestamp: string;
  sale_mode: 'retail' | 'wholesale';
  products: {
    name: string;
    sku: string | null;
    selling_price: number;
    vat_status: boolean;
    category: string | null;
    cost_price: number;
  };
}

export async function getSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<TransactionWithProduct[]> {
  console.log('📊 getSalesReport called with:', {
    storeId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  // Convert the input dates to Kenya timezone for proper comparison
  // Since the timestamps are stored in Kenya time, we need to compare them in the same timezone
  const startDateInKenya = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
  const endDateInKenya = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

  console.log('📊 Date range for filtering (Kenya timezone):', {
    startDate: startDateInKenya.toISOString(),
    endDate: endDateInKenya.toISOString(),
    startDateLocal: startDateInKenya.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
    endDateLocal: endDateInKenya.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  });

  // Get transactions
  const transactions = await db.transactions
    .where('store_id')
    .equals(storeId)
    .and((transaction: Transaction) => {
      if (!transaction.timestamp) {
        console.log('❌ Transaction missing timestamp:', transaction);
        return false;
      }
      
      // Parse the transaction timestamp which is stored in Kenya timezone format
      // Example: "6/17/2025, 1:08:02 AM"
      let transactionDate: Date;
      
      if (transaction.timestamp.includes(',')) {
        // Parse Kenya timezone format: "6/17/2025, 1:08:02 AM"
        const [datePart, timePart] = transaction.timestamp.split(', ');
        const [month, day, year] = datePart.split('/');
        const [time, period] = timePart.split(' ');
        const [hours, minutes, seconds] = time.split(':');
        
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        
        transactionDate = new Date(
          parseInt(year),
          parseInt(month) - 1, // Month is 0-indexed
          parseInt(day),
          hour,
          parseInt(minutes),
          parseInt(seconds || '0')
        );
      } else {
        // Fallback to standard Date parsing
        transactionDate = new Date(transaction.timestamp);
      }
      
      // Compare dates directly without timezone conversion
      const isInRange = transactionDate >= startDateInKenya && transactionDate <= endDateInKenya;
      
      console.log('🔍 Date comparison details:', {
        transaction_id: transaction.id,
        transaction_timestamp: transaction.timestamp,
        transaction_date_iso: transactionDate.toISOString(),
        transaction_date_local: transactionDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
        start_date_iso: startDateInKenya.toISOString(),
        end_date_iso: endDateInKenya.toISOString(),
        start_date_local: startDateInKenya.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
        end_date_local: endDateInKenya.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
        is_greater_than_start: transactionDate >= startDateInKenya,
        is_less_than_end: transactionDate <= endDateInKenya,
        is_in_range: isInRange,
        transaction_date_time: transactionDate.getTime(),
        start_date_time: startDateInKenya.getTime(),
        end_date_time: endDateInKenya.getTime()
      });
      
      if (isInRange) {
        console.log('✅ Transaction in range:', {
          id: transaction.id,
          timestamp: transaction.timestamp,
          date: transactionDate.toISOString(),
          dateInKenya: transactionDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
        });
      } else {
        console.log('❌ Transaction outside range:', {
          id: transaction.id,
          timestamp: transaction.timestamp,
          date: transactionDate.toISOString(),
          dateInKenya: transactionDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
        });
      }
      
      return isInRange;
    })
    .toArray();

  // Get sale items for each transaction
  const transactionsWithItems = await Promise.all(
    transactions.map(async (transaction: Transaction) => {
      const saleItems = await db.sale_items
        .where('sale_id')
        .equals(transaction.id)
        .toArray();

      // Get product details for each sale item
      const itemsWithProducts = await Promise.all(
        saleItems.map(async (item: SaleItem) => {
          const product = await db.products.get(item.product_id) as Product | undefined;
          
          // Debug logging for VAT calculation
          console.log('🔍 VAT Debug - Sale Item:', {
            product_id: item.product_id,
            product_name: product?.name,
            quantity: item.quantity,
            price: item.price,
            vat_amount_per_unit: item.vat_amount,
            vat_amount_total: item.vat_amount * item.quantity,
            calculation: `${item.vat_amount} × ${item.quantity} = ${item.vat_amount * item.quantity}`
          });
          
          return {
            id: transaction.id,
            product_id: item.product_id,
            quantity: item.quantity,
            total: item.price * item.quantity,
            vat_amount: item.vat_amount * item.quantity,
            payment_method: transaction.payment_method,
            timestamp: transaction.timestamp,
            sale_mode: item.sale_mode,
            products: {
              name: product?.name || 'Unknown',
              sku: product?.sku || null,
              selling_price: product?.selling_price || 0,
              vat_status: product?.vat_status || false,
              category: product?.category || null,
              cost_price: product?.cost_price || 0
            }
          };
        })
      );

      return itemsWithProducts;
    })
  );

  // Flatten the array of arrays
  const flattenedTransactions = transactionsWithItems.flat();

  // Filter out vatable products with zero VAT amount
  const filteredTransactions = flattenedTransactions.filter(t => {
    const isVatable = t.products?.vat_status === true;
    if (isVatable) {
      return (t.vat_amount || 0) > 0;
    }
    // For zero-rated/exempted, always include
    return true;
  });

  console.log('📊 Found transactions:', {
    count: filteredTransactions.length,
    transactions: filteredTransactions.map(t => ({
      id: t.id,
      timestamp: t.timestamp,
      total: t.total,
      product_name: t.products.name,
      sale_mode: t.sale_mode
    }))
  });

  return filteredTransactions;
}

export async function getStockReport(storeId: string) {
  return await db.products
    .where('store_id')
    .equals(storeId)
    .toArray();
}

export async function getETIMSReport(storeId: string, startDate: Date, endDate: Date) {
  console.log('🔍 getETIMSReport() - Fetching from local db', {
    storeId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  // Convert the input dates to Kenya timezone for proper comparison
  // Since the timestamps are stored in Kenya time, we need to compare them in the same timezone
  const startDateInKenya = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
  const endDateInKenya = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

  console.log('📊 Date range for filtering (Kenya timezone):', {
    startDate: startDateInKenya.toISOString(),
    endDate: endDateInKenya.toISOString(),
    startDateLocal: startDateInKenya.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
    endDateLocal: endDateInKenya.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  });

  const submissions = await db.etims_submissions
    .where('store_id')
    .equals(storeId)
    .and(submission => {
      if (!submission.submitted_at) {
        console.log('⚠️ Submission missing submitted_at:', submission);
        return false;
      }
      
      // Convert submission timestamp to Date object
      const submissionDate = new Date(submission.submitted_at);
      
      // Compare dates directly without timezone conversion
      const isInRange = submissionDate >= startDateInKenya && submissionDate <= endDateInKenya;
      if (!isInRange) {
        console.log('⏰ Submission outside date range:', {
          submissionDate: submissionDate.toISOString(),
          submissionDateInKenya: submissionDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
          submission: {
            id: submission.id,
            type: submission.submission_type,
            submitted_at: submission.submitted_at
          }
        });
      }
      return isInRange;
    })
    .toArray();

  console.log('📊 All submissions found:', {
    total: submissions.length,
    submissions: submissions.map(s => ({
      id: s.id,
      type: s.submission_type,
      submitted_at: s.submitted_at,
      status: s.status
    }))
  });

  // Separate input and output VAT submissions
  const inputVatSubmissions = submissions.filter(s => s.submission_type === 'input_vat');
  const outputVatSubmissions = submissions.filter(s => s.submission_type === 'output_vat');

  console.log('📈 Filtered submissions:', {
    inputVat: {
      count: inputVatSubmissions.length,
      submissions: inputVatSubmissions.map(s => ({
        id: s.id,
        submitted_at: s.submitted_at,
        status: s.status
      }))
    },
    outputVat: {
      count: outputVatSubmissions.length,
      submissions: outputVatSubmissions.map(s => ({
        id: s.id,
        submitted_at: s.submitted_at,
        status: s.status
      }))
    }
  });

  return {
    input_vat: inputVatSubmissions,
    output_vat: outputVatSubmissions,
    all: submissions
  };
}

export async function updateOfflineProductQuantity(productId: string, quantityChange: number) {
  const product = await db.products.get(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }

  // Update quantity
  const newQuantity = Math.max(0, product.quantity + quantityChange);
  
  // Save the updated product
  await db.products.put({
    ...product,
    quantity: newQuantity
  });

  // Also record the stock update
  await db.stock_updates.put({
    id: crypto.randomUUID(),
    product_id: productId,
    quantity_change: quantityChange,
    store_id: product.store_id || '',
    created_at: new Date().toISOString(),
    synced: false
  });

  return product;
}

// Barcode validation function for offline mode
export function validateOfflineBarcodeFormat(barcode: string | null): boolean {
  // Allow null and empty strings
  if (barcode === null || barcode === undefined || barcode.trim() === '') {
    return true;
  }
  
  const trimmedBarcode = barcode.trim();
  
  // EAN-13: 13 digits
  if (/^\d{13}$/.test(trimmedBarcode)) {
    return true;
  }
  
  // UPC-A: 12 digits
  if (/^\d{12}$/.test(trimmedBarcode)) {
    return true;
  }
  
  // Code 128: 1-48 alphanumeric characters
  if (/^[A-Za-z0-9\-\.\/\+\s]{1,48}$/.test(trimmedBarcode)) {
    return true;
  }
  
  // Code 39: 1-43 alphanumeric characters
  if (/^[A-Z0-9\-\.\/\+\s]{1,43}$/.test(trimmedBarcode)) {
    return true;
  }
  
  // QR Code: variable length (more permissive)
  if (trimmedBarcode.length <= 100) {
    return true;
  }
  
  return false;
}

export async function saveOfflineProduct(product: Database['public']['Tables']['products']['Insert']) {
  // Validate barcode format if provided
  if (product.barcode && !validateOfflineBarcodeFormat(product.barcode)) {
    throw new Error(`Invalid barcode format: ${product.barcode}`);
  }
  
  // Convert empty barcode string to null
  const barcodeValue = product.barcode?.trim() || null;
  
  const offlineProduct: OfflineProduct = {
    id: crypto.randomUUID(),
    name: product.name,
    sku: product.sku || null,
    quantity: product.quantity || 0,
    unit_of_measure: product.unit_of_measure || 'unit',
    units_per_pack: product.units_per_pack || 1,
    retail_price: product.retail_price || null,
    wholesale_price: product.wholesale_price || null,
    wholesale_threshold: product.wholesale_threshold || null,
    cost_price: product.cost_price || 0,
    vat_status: product.vat_status === true || (typeof product.vat_status === 'string' && product.vat_status === 'vatable') || false,
    category: product.category || null,
    store_id: product.store_id || null,
    parent_product_id: product.parent_product_id || null,
    selling_price: product.selling_price || 0,
    input_vat_amount: product.input_vat_amount || null,
    barcode: barcodeValue, // Use validated barcode value
    synced: false
  };

  await db.products.put(offlineProduct);
  return offlineProduct;
}

export async function updateOfflineStockQuantity(productId: string, quantityToAdd: number) {
  const product = await db.products.get(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }

  const newQuantity = product.quantity + quantityToAdd;
  
  // Save the updated product and mark as unsynced
  await db.products.put({
    ...product,
    quantity: newQuantity,
    synced: false
  });

  // Record the stock update
  await db.stock_updates.put({
    id: crypto.randomUUID(),
    product_id: productId,
    quantity_change: quantityToAdd,
    store_id: product.store_id || '',
    created_at: new Date().toISOString(),
    synced: false
  });

  return {
    ...product,
    quantity: newQuantity,
    synced: false
  };
}

// Save a purchase and its items, and update stock
export async function saveOfflinePurchase(purchase: Omit<OfflinePurchase, 'id' | 'created_at' | 'synced'>, items: Array<Omit<OfflinePurchaseItem, 'id' | 'created_at' | 'synced'>>) {
  console.log('🔄 saveOfflinePurchase: Starting purchase save:', {
    purchase: { ...purchase, items_count: items.length },
    items: items.map(item => ({ product_id: item.product_id, quantity: item.quantity }))
  });

  const purchaseId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const offlinePurchase: OfflinePurchase = {
    ...purchase,
    id: purchaseId,
    created_at: createdAt,
    synced: false
  };
  const offlineItems: OfflinePurchaseItem[] = items.map(item => ({
    ...item,
    id: crypto.randomUUID(),
    purchase_id: purchaseId,
    created_at: createdAt,
    synced: false
  }));

  console.log('🔄 saveOfflinePurchase: About to start transaction');
  
  await db.transaction('rw', [db.purchases, db.purchase_items, db.products], async () => {
    console.log('🔄 saveOfflinePurchase: Transaction started, saving purchase');
    await db.purchases.put(offlinePurchase);
    
    console.log('🔄 saveOfflinePurchase: Saving purchase items');
    await db.purchase_items.bulkPut(offlineItems);
    
    // Update product stock for each item
    for (const item of offlineItems) {
      if (item.product_id) { // Add null check
        console.log('🔄 saveOfflinePurchase: Updating stock for product:', item.product_id);
        const product = await db.products.get(item.product_id);
        if (product) {
          const oldQuantity = product.quantity || 0;
          const newQuantity = oldQuantity + item.quantity;
          console.log('🔄 saveOfflinePurchase: Stock update details:', {
            product_id: item.product_id,
            product_name: product.name,
            old_quantity: oldQuantity,
            quantity_to_add: item.quantity,
            new_quantity: newQuantity
          });
          
          await db.products.put({
            ...product,
            quantity: newQuantity,
            synced: false
          });
          
          // Verify the update
          const updatedProduct = await db.products.get(item.product_id);
          console.log('✅ saveOfflinePurchase: Stock update verified:', {
            product_id: item.product_id,
            final_quantity: updatedProduct?.quantity,
            synced: updatedProduct?.synced
          });
        } else {
          console.error('❌ saveOfflinePurchase: Product not found:', item.product_id);
        }
      }
    }
  });

  console.log('✅ saveOfflinePurchase: Transaction completed successfully');
  
  // Get final state of products for verification
  const finalProducts = await db.products
    .where('id')
    .anyOf(items.map(item => item.product_id).filter((id): id is string => id !== null))
    .toArray();

  console.log('📊 saveOfflinePurchase: Final product quantities:', {
    products: finalProducts.map(p => ({
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      synced: p.synced
    }))
  });

  return { ...offlinePurchase, items: offlineItems };
}

export async function getPendingPurchases() {
  // Defensive: filter for boolean false, avoid index error if some records are missing 'synced'
  return await db.purchases.filter(p => p.synced === false).toArray();
}

export async function markPurchaseAsSynced(id: string) {
  await db.purchases.update(id, { synced: true });
  await db.purchase_items.where('purchase_id').equals(id).modify({ synced: true });
}

export async function clearOfflinePurchases() {
  await db.purchases.clear();
  await db.purchase_items.clear();
}

// Save a supplier to the offline DB
export async function saveOfflineSupplier(supplier: Omit<Database['public']['Tables']['suppliers']['Insert'], 'id' | 'created_at'>) {
  const offlineSupplier: OfflineSupplier = {
    ...supplier,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    contact_info: supplier.contact_info ?? null,
    vat_no: supplier.vat_no ?? null,
    synced: false
  };
  await db.suppliers.put(offlineSupplier);
  return offlineSupplier;
}

// Get all suppliers that are not yet synced
export async function getPendingSuppliers() {
  // Defensive: filter for boolean false, avoid index error if some records are missing 'synced'
  return await db.suppliers.filter(s => s.synced === false).toArray();
}

export async function getAllSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<TransactionWithProduct[]> {
  console.log('📊 getAllSalesReport called with:', {
    storeId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  // Convert the input dates to Kenya timezone for proper comparison
  const startDateInKenya = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
  const endDateInKenya = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

  // Get transactions
  const transactions = await db.transactions
    .where('store_id')
    .equals(storeId)
    .and((transaction: Transaction) => {
      if (!transaction.timestamp) return false;
      let transactionDate: Date;
      if (transaction.timestamp.includes(',')) {
        const [datePart, timePart] = transaction.timestamp.split(', ');
        const [month, day, year] = datePart.split('/');
        const [time, period] = timePart.split(' ');
        const [hours, minutes, seconds] = time.split(':');
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        transactionDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hour,
          parseInt(minutes),
          parseInt(seconds || '0')
        );
      } else {
        transactionDate = new Date(transaction.timestamp);
      }
      return transactionDate >= startDateInKenya && transactionDate <= endDateInKenya;
    })
    .toArray();

  // Get sale items for each transaction
  const transactionsWithItems = await Promise.all(
    transactions.map(async (transaction: Transaction) => {
      const saleItems = await db.sale_items
        .where('sale_id')
        .equals(transaction.id)
        .toArray();
      const itemsWithProducts = await Promise.all(
        saleItems.map(async (item: SaleItem) => {
          const product = await db.products.get(item.product_id) as Product | undefined;
          return {
            id: transaction.id,
            product_id: item.product_id,
            quantity: item.quantity,
            total: item.price * item.quantity,
            vat_amount: item.vat_amount * item.quantity,
            payment_method: transaction.payment_method,
            timestamp: transaction.timestamp,
            sale_mode: item.sale_mode,
            products: {
              name: product?.name || 'Unknown',
              sku: product?.sku || null,
              selling_price: product?.selling_price || 0,
              vat_status: product?.vat_status || false,
              category: product?.category || null,
              cost_price: product?.cost_price || 0
            }
          };
        })
      );
      return itemsWithProducts;
    })
  );

  // Flatten the array of arrays
  const flattenedTransactions = transactionsWithItems.flat();

  console.log('📊 Found ALL transactions:', {
    count: flattenedTransactions.length,
    transactions: flattenedTransactions.map(t => ({
      id: t.id,
      timestamp: t.timestamp,
      total: t.total,
      product_name: t.products.name,
      sale_mode: t.sale_mode
    }))
  });

  return flattenedTransactions;
}

// Helper functions for offline app settings
export async function cacheAppSettings(settings: OfflineAppSettings) {
  await db.app_settings.put(settings);
}

export async function getCachedAppSettings(): Promise<OfflineAppSettings | undefined> {
  return await db.app_settings.get('global');
}

// Store management functions for offline mode
export async function saveOfflineStore(store: {
  id: string;
  name: string;
  address?: string;
  kra_pin?: string;
  vat_number?: string;
  etims_username?: string;
  etims_password?: string;
  kra_token?: string;
  mpesa_details?: string;
}) {
  console.log('🔄 saveOfflineStore: Saving store to offline database:', { id: store.id, name: store.name });
  
  const offlineStore: Database['public']['Tables']['stores']['Row'] = {
    id: store.id,
    name: store.name,
    address: store.address || null,
    kra_pin: store.kra_pin || null,
    vat_number: store.vat_number || null,
    etims_username: store.etims_username || null,
    etims_password: store.etims_password || null,
    kra_token: store.kra_token || null,
    mpesa_details: store.mpesa_details || null
  };

  await db.stores.put(offlineStore);
  console.log('✅ Store saved to offline database:', { id: store.id, name: store.name });
  return offlineStore;
}

export async function getOfflineStore(storeId: string): Promise<Database['public']['Tables']['stores']['Row'] | undefined> {
  try {
    const store = await db.stores.get(storeId);
    if (store) {
      console.log('📋 Retrieved store from offline database:', { id: store.id, name: store.name });
    } else {
      console.log('⚠️ Store not found in offline database:', storeId);
    }
    return store;
  } catch (error) {
    console.error('❌ Error retrieving store from offline database:', error);
    return undefined;
  }
}

/**
 * Update a product's price fields (cost_price, retail_price, wholesale_price) in the local DB.
 * Marks the product as synced: false for offline-first sync.
 */
export async function updateOfflineProductPrice(productId: string, field: 'cost_price' | 'retail_price' | 'wholesale_price', newValue: number) {
  const product = await db.products.get(productId);
  if (!product) throw new Error('Product not found');
  await db.products.put({
    ...product,
    [field]: newValue,
    synced: false,
  });
  return { ...product, [field]: newValue, synced: false };
}

/**
 * Utility: Find and log all purchases and purchase items with missing or empty UUIDs.
 */
export async function logInvalidPurchaseUUIDs() {
  const purchases = await db.purchases.toArray();
  const invalidPurchases = purchases.filter(p => !p.id || !p.supplier_id || p.id === '' || p.supplier_id === '');
  if (invalidPurchases.length > 0) {
    console.warn('⚠️ Invalid purchases with missing/empty UUIDs:', invalidPurchases);
  } else {
    console.log('✅ No invalid purchases with missing/empty UUIDs found.');
  }
  const items = await db.purchase_items.toArray();
  const invalidItems = items.filter(item => !item.id || !item.purchase_id || !item.product_id || item.id === '' || item.purchase_id === '' || item.product_id === '');
  if (invalidItems.length > 0) {
    console.warn('⚠️ Invalid purchase items with missing/empty UUIDs:', invalidItems);
  } else {
    console.log('✅ No invalid purchase items with missing/empty UUIDs found.');
  }
} 

export async function getProductByBarcode(barcode: string, storeId: string): Promise<OfflineProduct | undefined> {
  console.log('🔍 getProductByBarcode: Looking up product by barcode:', { barcode, storeId });
  
  try {
    const product = await db.products
      .where(['barcode', 'store_id'])
      .equals([barcode, storeId])
      .first();
    
    if (product) {
      console.log('✅ getProductByBarcode: Product found:', { 
        id: product.id, 
        name: product.name, 
        barcode: product.barcode,
        quantity: product.quantity 
      });
    } else {
      console.log('⚠️ getProductByBarcode: Product not found for barcode:', barcode);
    }
    
    return product;
  } catch (error) {
    console.error('❌ getProductByBarcode: Error looking up product:', error);
    return undefined;
  }
}

export async function validateBarcodeUniqueness(barcode: string, storeId: string, excludeProductId?: string): Promise<boolean> {
  console.log('🔍 validateBarcodeUniqueness: Checking barcode uniqueness:', { barcode, storeId, excludeProductId });
  
  try {
    let query = db.products
      .where(['barcode', 'store_id'])
      .equals([barcode, storeId]);
    
    if (excludeProductId) {
      query = query.filter(product => product.id !== excludeProductId);
    }
    
    const existingProducts = await query.toArray();
    const isUnique = existingProducts.length === 0;
    
    console.log('✅ validateBarcodeUniqueness: Result:', { 
      barcode, 
      isUnique, 
      existingCount: existingProducts.length 
    });
    
    return isUnique;
  } catch (error) {
    console.error('❌ validateBarcodeUniqueness: Error checking uniqueness:', error);
    return false;
  }
}

export async function updateProductBarcode(productId: string, barcode: string | null): Promise<OfflineProduct | null> {
  console.log('🔄 updateProductBarcode: Updating product barcode:', { productId, barcode });
  
  try {
    const product = await db.products.get(productId);
    if (!product) {
      console.error('❌ updateProductBarcode: Product not found:', productId);
      return null;
    }
    
    const updatedProduct: OfflineProduct = {
      ...product,
      barcode,
      synced: false // Mark as unsynced for sync
    };
    
    await db.products.put(updatedProduct);
    console.log('✅ updateProductBarcode: Product barcode updated successfully');
    
    return updatedProduct;
  } catch (error) {
    console.error('❌ updateProductBarcode: Error updating product barcode:', error);
    return null;
  }
}

export async function getProductsByBarcodePattern(pattern: string, storeId: string): Promise<OfflineProduct[]> {
  console.log('🔍 getProductsByBarcodePattern: Searching products by barcode pattern:', { pattern, storeId });
  
  try {
    const products = await db.products
      .where('store_id')
      .equals(storeId)
      .filter(product => 
        product.barcode !== null && 
        product.barcode !== undefined &&
        product.barcode.toLowerCase().includes(pattern.toLowerCase())
      )
      .toArray();
    
    console.log('✅ getProductsByBarcodePattern: Found products:', { 
      pattern, 
      count: products.length,
      products: products.map(p => ({ id: p.id, name: p.name, barcode: p.barcode }))
    });
    
    return products;
  } catch (error) {
    console.error('❌ getProductsByBarcodePattern: Error searching products:', error);
    return [];
  }
} 