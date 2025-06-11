import Dexie, { Table } from 'dexie';
import { Database } from '@/types/supabase';

export class OfflineDB extends Dexie {
  products!: Table<Database['public']['Tables']['products']['Row'] & { synced: boolean }>;
  stores!: Table<Database['public']['Tables']['stores']['Row']>;
  transactions!: Table<{
    id: string;
    store_id: string;
    payment_method: string;
    total_amount: number;
    vat_total: number;
    timestamp: string;
    synced: boolean;
    created_at: string;
  }>;
  sale_items!: Table<{
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    price: number;
    vat_amount: number;
    sale_mode: 'retail' | 'wholesale';
    timestamp: string;
    created_at: string;
  }>;
  etims_submissions!: Table<Database['public']['Tables']['etims_submissions']['Row']>;
  users!: Table<Database['public']['Tables']['users']['Row']>;
  stock_updates!: Table<{
    id: string;
    product_id: string;
    quantity_change: number;
    store_id: string;
    created_at: string;
    synced: boolean;
  }>;

  constructor() {
    super('OfflineDB');
    this.version(3).stores({
      products: 'id, store_id, name, sku, category, parent_product_id, synced, created_at',
      stores: 'id, name, address, kra_pin, vat_number, etims_username, etims_password, kra_token, mpesa_details',
      transactions: 'id, store_id, payment_method, total_amount, vat_total, timestamp, synced, created_at',
      sale_items: 'id, sale_id, product_id, quantity, price, vat_amount, sale_mode, timestamp, created_at',
      etims_submissions: 'id, store_id, invoice_number, data, status, submitted_at, synced, created_at',
      users: 'id, store_id, role',
      stock_updates: 'id, product_id, quantity_change, store_id, synced, created_at'
    }).upgrade(tx => {
      return Promise.all([
        tx.products.toCollection().modify(product => {
          if (!product.created_at) {
            product.created_at = new Date().toISOString();
          }
        }),
        tx.transactions.toCollection().modify(transaction => {
          if (!transaction.created_at) {
            transaction.created_at = new Date().toISOString();
          }
        }),
        tx.sale_items.toCollection().modify(item => {
          if (!item.created_at) {
            item.created_at = new Date().toISOString();
          }
        }),
        tx.stock_updates.toCollection().modify(update => {
          if (!update.created_at) {
            update.created_at = new Date().toISOString();
          }
        }),
        tx.etims_submissions.toCollection().modify(submission => {
          if (!submission.created_at) {
            submission.created_at = new Date().toISOString();
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
  await db.products.bulkPut(products);
}

export async function getCachedProducts(storeId: string) {
  return await db.products.where('store_id').equals(storeId).toArray();
}

export async function cacheTransaction(transaction: Database['public']['Tables']['transactions']['Row']) {
  await db.transactions.put(transaction);
}

export async function getPendingTransactions(storeId: string) {
  return await db.transactions
    .where('store_id')
    .equals(storeId)
    .and(transaction => !transaction.synced)
    .toArray();
}

export async function cacheETIMSSubmission(submission: Database['public']['Tables']['etims_submissions']['Row']) {
  await db.etims_submissions.put(submission);
}

export async function getPendingETIMSSubmissions(storeId: string) {
  return await db.etims_submissions
    .where('store_id')
    .equals(storeId)
    .and(submission => submission.status === 'pending')
    .toArray();
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
  const store = await db.stores.get(user.store_id);
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
  payment_method: 'cash' | 'mpesa';
  total_amount: number;
  vat_total: number;
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
  const localTime = keTime.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' });
  const utcTime = keTime.toUTCString();

  // Ensure sale has a timestamp
  const saleWithTimestamp = {
    ...sale,
    timestamp: sale.timestamp || timestampISO
  };

  

  // Create the sale record
  const saleRecord = {
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
  const saleItems = sale.products.map(product => ({
    id: crypto.randomUUID(),
    sale_id: saleId,
    product_id: product.id,
    quantity: product.quantity,
    price: product.displayPrice,
    vat_amount: product.vat_amount,
    sale_mode: 'retail' as const,
    timestamp: timestampISO,
    created_at: timestampISO
  }));

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
  const offlineSubmission: Database['public']['Tables']['etims_submissions']['Insert'] = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    error_message: null,
    invoice_number: submission.invoice_number,
    response_data: null,
    status: submission.status,
    store_id: submission.store_id,
    submitted_at: submission.submitted_at,
    updated_at: new Date().toISOString()
  };
  
  await db.etims_submissions.put(offlineSubmission);
  return offlineSubmission;
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
}

interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price: number;
  vat_amount: number;
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
  products: {
    name: string;
    sku: string | null;
    selling_price: number;
    vat_status: boolean;
    category: string | null;
  };
}

export async function getSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<TransactionWithProduct[]> {
  console.log('📊 getSalesReport called with:', {
    storeId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  // Set start date to beginning of day in Kenya timezone
  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Set end date to end of day in Kenya timezone
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);

  console.log('📊 Date range for filtering:', {
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString()
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
      
      // Convert transaction timestamp to Date object
      const transactionDate = new Date(transaction.timestamp);
      
      // Compare dates directly
      const isInRange = transactionDate >= startOfDay && transactionDate <= endOfDay;
      
      if (isInRange) {
        console.log('✅ Transaction in range:', {
          id: transaction.id,
          timestamp: transaction.timestamp,
          date: transactionDate.toISOString()
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
          return {
            id: transaction.id,
            product_id: item.product_id,
            quantity: item.quantity,
            total: item.price,
            vat_amount: item.vat_amount,
            payment_method: transaction.payment_method,
            timestamp: transaction.timestamp,
            products: {
              name: product?.name || 'Unknown',
              sku: product?.sku || null,
              selling_price: product?.selling_price || 0,
              vat_status: product?.vat_status || false,
              category: product?.category || null
            }
          };
        })
      );

      return itemsWithProducts;
    })
  );

  // Flatten the array of arrays
  const flattenedTransactions = transactionsWithItems.flat();

  console.log('📊 Found transactions:', {
    count: flattenedTransactions.length,
    transactions: flattenedTransactions.map(t => ({
      id: t.id,
      timestamp: t.timestamp,
      total: t.total,
      product_name: t.products.name
    }))
  });

  return flattenedTransactions;
}

export async function getStockReport(storeId: string) {
  return await db.products
    .where('store_id')
    .equals(storeId)
    .toArray();
}

export async function getETIMSReport(storeId: string, startDate: Date, endDate: Date) {
  // Set start date to beginning of day in Kenya timezone
  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Set end date to end of day in Kenya timezone
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);

  return await db.etims_submissions
    .where('store_id')
    .equals(storeId)
    .and(submission => {
      if (!submission.submitted_at) return false;
      
      // Convert submission timestamp to Date object
      const submissionDate = new Date(submission.submitted_at);
      
      // Compare dates directly
      return submissionDate >= startOfDay && submissionDate <= endOfDay;
    })
    .toArray();
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
    store_id: product.store_id,
    created_at: new Date().toISOString(),
    synced: false
  });

  return product;
}

export async function saveOfflineProduct(product: Database['public']['Tables']['products']['Insert']) {
  const offlineProduct: Database['public']['Tables']['products']['Row'] = {
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
    vat_status: product.vat_status || null,
    category: product.category || null,
    store_id: product.store_id || null,
    parent_product_id: product.parent_product_id || null,
    selling_price: product.selling_price || 0,
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