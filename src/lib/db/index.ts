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
      products: 'id, store_id, name, sku, category, parent_product_id, synced, created_at, updated_at',
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
          if (!product.updated_at) {
            product.updated_at = new Date().toISOString();
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
  const timestamp = new Date().toISOString();

  console.log('📦 Starting saveOfflineSale:', {
    sale_id: saleId,
    products: sale.products.map(p => ({
      id: p.id,
      quantity: p.quantity
    }))
  });

  // Create the sale record
  const saleRecord = {
    id: saleId,
    store_id: sale.store_id,
    payment_method: sale.payment_method,
    total_amount: sale.total_amount,
    vat_total: sale.vat_total,
    timestamp,
    created_at: timestamp,
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
    timestamp,
    created_at: timestamp
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
          updated_at: timestamp
        });

        // Verify the update
        const updatedProduct = await db.products.get(product.id);
        console.log('📊 Product after update:', {
          product_id: product.id,
          new_quantity: updatedProduct?.quantity
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
    timestamp,
    created_at: timestamp,
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

export async function getSalesReport(storeId: string, startDate: Date, endDate: Date) {
  // Set start date to beginning of day and end date to end of day
  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);

  return await db.transactions
    .where('store_id')
    .equals(storeId)
    .and(transaction => {
      if (!transaction.timestamp) return false;
      const transactionDate = new Date(transaction.timestamp);
      return transactionDate >= startOfDay && transactionDate <= endOfDay;
    })
    .toArray();
}

export async function getStockReport(storeId: string) {
  return await db.products
    .where('store_id')
    .equals(storeId)
    .toArray();
}

export async function getETIMSReport(storeId: string, startDate: Date, endDate: Date) {
  return await db.etims_submissions
    .where('store_id')
    .equals(storeId)
    .and(submission => {
      if (!submission.submitted_at) return false;
      const submissionDate = new Date(submission.submitted_at);
      return submissionDate >= startDate && submissionDate <= endDate;
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
  
  await db.products.update(productId, {
    quantity: newQuantity
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
    quantity: newQuantity
  };
} 