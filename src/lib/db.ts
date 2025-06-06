import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ProductsDB extends DBSchema {
  products: {
    key: string;
    value: {
      id: string;
      name: string;
      sku: string;
      retail_price: number;
      wholesale_price: number;
      wholesale_threshold: number;
      store_id: string;
      created_at: string;
      updated_at: string;
    };
    indexes: { 'by-store': string };
  };
  users: {
    key: string;
    value: {
      id: string;
      email: string;
      role: string;
      store_id: string;
    };
  };
  sales: {
    key: string;
    value: {
      id: string;
      items: Array<{
        product_id: string;
        quantity: number;
        price: number;
      }>;
      total: number;
      store_id: string;
      created_at: string;
    };
  };
  stock_updates: {
    key: string;
    value: {
      id: string;
      product_id: string;
      quantity: number;
      store_id: string;
      created_at: string;
    };
  };
  etims_submissions: {
    key: string;
    value: {
      id: string;
      type: string;
      data: any;
      store_id: string;
      created_at: string;
    };
  };
}

let db: IDBPDatabase<ProductsDB> | null = null;

async function getDB() {
  if (!db) {
    db = await openDB<ProductsDB>('pos-system', 1, {
      upgrade(db) {
        const productsStore = db.createObjectStore('products', { keyPath: 'id' });
        productsStore.createIndex('by-store', 'store_id');

        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
        const stockUpdatesStore = db.createObjectStore('stock_updates', { keyPath: 'id' });
        const etimsSubmissionsStore = db.createObjectStore('etims_submissions', { keyPath: 'id' });
      },
    });
  }
  return db;
}

// Product functions
export async function getOfflineProducts() {
  const db = await getDB();
  return db.getAll('products');
}

export async function saveOfflineProducts(products: ProductsDB['products']['value'][]) {
  const db = await getDB();
  const tx = db.transaction('products', 'readwrite');
  await Promise.all([
    ...products.map(product => tx.store.put(product)),
    tx.done,
  ]);
}

export async function clearOfflineProducts() {
  const db = await getDB();
  await db.clear('products');
}

// User functions
export async function getOfflineUser(userId: string) {
  const db = await getDB();
  return db.get('users', userId);
}

export async function cacheUser(user: ProductsDB['users']['value']) {
  const db = await getDB();
  await db.put('users', user);
}

// Sales functions
export async function saveOfflineSale(sale: ProductsDB['sales']['value']) {
  const db = await getDB();
  await db.put('sales', sale);
}

export async function getSalesReport() {
  const db = await getDB();
  return db.getAll('sales');
}

// Stock functions
export async function saveOfflineStockUpdate(update: ProductsDB['stock_updates']['value']) {
  const db = await getDB();
  await db.put('stock_updates', update);
}

export async function getStockReport() {
  const db = await getDB();
  return db.getAll('stock_updates');
}

// ETIMS functions
export async function saveOfflineETIMSSubmission(submission: ProductsDB['etims_submissions']['value']) {
  const db = await getDB();
  await db.put('etims_submissions', submission);
}

export async function getETIMSReport() {
  const db = await getDB();
  return db.getAll('etims_submissions');
}

// Sync functions
export async function processSyncQueue() {
  const db = await getDB();
  const sales = await db.getAll('sales');
  const stockUpdates = await db.getAll('stock_updates');
  const etimsSubmissions = await db.getAll('etims_submissions');
  
  return {
    sales,
    stockUpdates,
    etimsSubmissions
  };
}

// Alias functions for backward compatibility
export const cacheProducts = saveOfflineProducts;
export const getCachedProducts = getOfflineProducts; 