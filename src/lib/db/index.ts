import Dexie, { Table } from 'dexie';
import { Database } from '@/types/supabase';

export class OfflineDB extends Dexie {
  products!: Table<Database['public']['Tables']['products']['Row']>;
  stores!: Table<Database['public']['Tables']['stores']['Row']>;
  transactions!: Table<Database['public']['Tables']['transactions']['Row']>;
  etims_submissions!: Table<Database['public']['Tables']['etims_submissions']['Row']>;
  users!: Table<Database['public']['Tables']['users']['Row']>;

  constructor() {
    super('OfflineDB');
    this.version(1).stores({
      products: 'id, store_id, name, sku, category, parent_product_id',
      stores: 'id, name, address, kra_pin, vat_number, etims_username, etims_password, kra_token, mpesa_details',
      transactions: 'id, store_id, product_id, quantity, total, vat_amount, payment_method, timestamp, synced',
      etims_submissions: 'id, store_id, invoice_number, status, submitted_at, response_data, error_message, created_at, updated_at',
      users: 'id, store_id, role'
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
  await Promise.all([
    db.products.clear(),
    db.transactions.clear(),
    db.etims_submissions.clear(),
    db.users.clear()
  ]);
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

export async function saveOfflineSale(sale: Omit<Database['public']['Tables']['transactions']['Insert'], 'id' | 'timestamp' | 'synced'>) {
  const offlineSale: Database['public']['Tables']['transactions']['Insert'] = {
    id: crypto.randomUUID(),
    payment_method: sale.payment_method ?? null,
    product_id: sale.product_id ?? null,
    quantity: sale.quantity,
    store_id: sale.store_id ?? null,
    synced: false,
    timestamp: new Date().toISOString(),
    total: sale.total,
    vat_amount: sale.vat_amount ?? null
  };
  
  await db.transactions.put(offlineSale);
  return offlineSale;
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
  // Get all pending transactions
  const pendingTransactions = await db.transactions
    .where('synced')
    .equals('false')
    .toArray();

  // Get all pending ETIMS submissions
  const pendingETIMS = await db.etims_submissions
    .where('status')
    .equals('pending')
    .toArray();

  return {
    pendingTransactions,
    pendingETIMS
  };
}

export async function getSalesReport(storeId: string, startDate: Date, endDate: Date) {
  return await db.transactions
    .where('store_id')
    .equals(storeId)
    .and(transaction => {
      if (!transaction.timestamp) return false;
      const transactionDate = new Date(transaction.timestamp);
      return transactionDate >= startDate && transactionDate <= endDate;
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