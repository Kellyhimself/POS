import { createClient } from '@/lib/supabase-clients/pages';
import { 
  cacheProducts, 
  getCachedProducts,
  saveOfflineSale,
  saveOfflineStockUpdate,
  saveOfflineETIMSSubmission,
  processSyncQueue,
  getSalesReport,
  getStockReport,
  getETIMSReport,
  db,
  clearOfflineData
} from '@/lib/db/index';
import { Database } from '@/types/supabase';

type Product = Database['public']['Tables']['products']['Row'];
type Sale = Database['public']['Tables']['transactions']['Row'];
type StockUpdate = {
  product_id: string;
  store_id: string;
  quantity_change: number;
};

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
  is_sync?: boolean;
}

export class SyncService {
  private supabase = createClient();
  private syncInterval: NodeJS.Timeout | null = null;
  private isOnline = true;
  private isClient = false;

  constructor() {
    // Check if we're in a browser environment
    this.isClient = typeof window !== 'undefined';
    
    if (this.isClient) {
      // Set up online/offline detection
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      this.isOnline = navigator.onLine;
    }
  }

  private handleOnline() {
    this.isOnline = true;
    this.startSync();
  }

  private handleOffline() {
    this.isOnline = false;
    this.stopSync();
  }

  // Start periodic sync
  public startSync(interval = 60000) { // Default: 1 minute
    if (!this.isClient || this.syncInterval) return;
    this.syncInterval = setInterval(() => this.sync(), interval);
  }

  // Stop periodic sync
  public stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Initial data sync
  public async initialSync(store_id: string) {
    try {
      // Fetch and cache products
      const { data: products, error: productsError } = await this.supabase
        .from('products')
        .select('*')
        .eq('store_id', store_id);

      if (productsError) throw productsError;
      if (products) await cacheProducts(products);

      // Process any pending syncs
      await this.sync();
    } catch (error) {
      console.error('Initial sync failed:', error);
      throw error;
    }
  }

  // Main sync function
  private async sync() {
    if (!this.isOnline) return;

    try {
      console.log('🔄 Starting sync process...');
      const { pendingTransactions } = await processSyncQueue();
      console.log(`📦 Found ${pendingTransactions.length} pending transactions to sync`);

      // Process each pending transaction
      for (const transaction of pendingTransactions) {
        try {
          console.log(`🔄 Processing transaction ${transaction.id}...`);
          
          // Get the sale items for this transaction
          const saleItems = await db.sale_items
            .where('sale_id')
            .equals(transaction.id)
            .toArray();

          console.log(`📦 Found ${saleItems.length} items in transaction ${transaction.id}`);

          // Prepare products array for createSale RPC
          const products = saleItems.map(item => ({
            id: item.product_id,
            quantity: item.quantity,
            displayPrice: item.price,
            vat_amount: item.vat_amount
          }));

          // Call createSale RPC - this will handle stock updates internally
          console.log('🔄 Calling create_sale RPC...');
          const { data: transactionId, error } = await this.supabase
            .rpc('create_sale', {
              p_store_id: transaction.store_id,
              p_products: products,
              p_payment_method: transaction.payment_method,
              p_total_amount: transaction.total_amount,
              p_vat_total: transaction.vat_total
            });

          if (error) {
            console.error('❌ create_sale RPC error:', {
              error: error.message,
              details: error.details
            });
            throw error;
          }

          // Mark transaction as synced and remove from pending queue
          await db.transactions.update(transaction.id, { synced: true });
          console.log('✅ Transaction synced successfully:', {
            transaction_id: transaction.id,
            store_id: transaction.store_id,
            server_transaction_id: transactionId
          });

          // Remove the synced sale items
          await db.sale_items
            .where('sale_id')
            .equals(transaction.id)
            .delete();

          console.log('🧹 Cleaned up synced sale items');
        } catch (error) {
          console.error(`❌ Failed to sync transaction ${transaction.id}:`, error);
          // Continue with next transaction even if one fails
        }
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
    }
  }

  // Save a sale (works offline)
  public async saveSale(sale: SaleInput) {
    try {
      console.log('🔄 Starting saveSale process:', {
        store_id: sale.store_id,
        total_amount: sale.total_amount,
        product_count: sale.products.length,
        is_sync: sale.is_sync,
        products: sale.products.map(p => ({
          id: p.id,
          quantity: p.quantity,
          displayPrice: p.displayPrice
        }))
      });

      const timestamp = new Date().toISOString();

      // Save locally first with timestamp
      const offlineSale = await saveOfflineSale({
        ...sale,
        created_at: timestamp
      });

      // Log the state after saving offline
      console.log('📦 Saved offline sale:', {
        sale_id: offlineSale.id,
        items_count: offlineSale.items.length,
        created_at: timestamp,
        synced: offlineSale.synced,
        items: offlineSale.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        }))
      });

      // If online, try to sync immediately
      if (this.isOnline) {
        console.log('🔄 Online - attempting immediate sync...');
        
        // If this is a sync operation, get the current quantities from local DB
        let finalQuantities = null;
        if (sale.is_sync) {
          const products = await db.products
            .where('id')
            .anyOf(sale.products.map(p => p.id))
            .toArray();
          
          finalQuantities = products.map(p => ({
            product_id: p.id,
            quantity: p.quantity
          }));

          console.log('📊 Current local quantities before sync:', {
            products: products.map(p => ({
              id: p.id,
              quantity: p.quantity
            }))
          });
        }
        
        // Call createSale RPC
        console.log('🔄 Calling create_sale RPC with params:', {
          store_id: sale.store_id,
          is_sync: sale.is_sync,
          products: sale.products.map(p => ({
            id: p.id,
            quantity: p.quantity
          }))
        });

        const { data: transactionId, error } = await this.supabase
          .rpc('create_sale', {
            p_store_id: sale.store_id,
            p_products: sale.products,
            p_payment_method: sale.payment_method,
            p_total_amount: sale.total_amount,
            p_vat_total: sale.vat_total,
            p_is_sync: sale.is_sync
          });

        if (error) {
          console.error('❌ Error in saveSale:', {
            store_id: sale.store_id,
            error: error.message,
            details: error.details,
            hint: error.hint
          });
          throw error;
        }

        // Mark transaction as synced and remove from pending queue
        await db.transactions.update(offlineSale.id, { 
          synced: true,
          created_at: timestamp
        });
        
        // Get the updated transaction to verify the sync status
        const updatedTransaction = await db.transactions.get(offlineSale.id);
        
        // Get the current quantities after sync
        const productsAfterSync = await db.products
          .where('id')
          .anyOf(sale.products.map(p => p.id))
          .toArray();

        console.log('✅ Sync completed:', {
          transaction_id: offlineSale.id,
          store_id: sale.store_id,
          server_transaction_id: transactionId,
          synced: updatedTransaction?.synced,
          created_at: timestamp,
          quantities_after_sync: productsAfterSync.map(p => ({
            id: p.id,
            quantity: p.quantity
          }))
        });

        // Remove the synced sale items
        await db.sale_items
          .where('sale_id')
          .equals(offlineSale.id)
          .delete();

        console.log('🧹 Cleaned up synced sale items');
      }

      return offlineSale;
    } catch (error) {
      console.error('❌ Error syncing sale:', error);
      throw error;
    }
  }

  // Update stock (works offline)
  public async updateStock(productId: string, localQuantity: number) {
    try {
      // First get the current product from Supabase
      const { data: currentProduct, error: fetchError } = await this.supabase
        .from('products')
        .select('quantity')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      // Calculate the difference between local and remote quantities
      const remoteQuantity = currentProduct?.quantity || 0;
      const quantityDifference = localQuantity - remoteQuantity;

      console.log('📊 Calculating quantity difference:', {
        product_id: productId,
        local_quantity: localQuantity,
        remote_quantity: remoteQuantity,
        difference: quantityDifference
      });

      // Update the product quantity
      const { data, error } = await this.supabase
        .from('products')
        .update({ quantity: localQuantity })
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  // Submit to eTIMS (works offline)
  public async submitToETIMS(submission: {
    store_id: string;
    invoice_number: string;
    data: any;
  }) {
    try {
      // Save locally first
      const offlineSubmission = await saveOfflineETIMSSubmission({
        ...submission,
        status: 'pending',
        submitted_at: new Date()
      });

      // If online, try to submit immediately
      if (this.isOnline) {
        const response = await fetch('/api/etims/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submission)
        });

        if (!response.ok) throw new Error('eTIMS submission failed');
        const responseData = await response.json();
        return responseData;
      }

      return offlineSubmission;
    } catch (error) {
      console.error('Error submitting to eTIMS:', error);
      throw error;
    }
  }

  // Get products (works offline)
  public async getProducts(store_id: string) {
    try {
      // Try to get from cache first
      const cachedProducts = await getCachedProducts(store_id);
      if (cachedProducts.length > 0) return cachedProducts;

      // If no cache and online, fetch from server
      if (this.isOnline) {
        const { data, error } = await this.supabase
          .from('products')
          .select('*')
          .eq('store_id', store_id);

        if (error) throw error;
        if (data) {
          await cacheProducts(data);
          return data;
        }
      }

      return [];
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  // Generate reports (works offline)
  public async generateReports(store_id: string, startDate: Date, endDate: Date) {
    try {
      const [sales, stock, etims] = await Promise.all([
        getSalesReport(store_id, startDate, endDate),
        getStockReport(store_id),
        getETIMSReport(store_id, startDate, endDate)
      ]);

      return {
        sales,
        stock,
        etims,
        generated_at: new Date(),
        is_offline: !this.isOnline
      };
    } catch (error) {
      console.error('Error generating reports:', error);
      throw error;
    }
  }

  // Get sales with product details
  public async getSalesWithProducts(store_id: string, startDate: Date, endDate: Date): Promise<Array<Database['public']['Tables']['transactions']['Row'] & {
    products: {
      name: string;
      sku: string | null;
      selling_price: number;
      vat_status: boolean | null;
      category: string | null;
    } | null;
  }>> {
    // Set start date to beginning of day and end date to end of day
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data, error } = await this.supabase
      .from('transactions')
      .select(`
        *,
        products:product_id (
          name,
          sku,
          selling_price,
          vat_status,
          category
        )
      `)
      .eq('store_id', store_id)
      .gte('timestamp', startOfDay.toISOString())
      .lte('timestamp', endOfDay.toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Clear all offline data and reset sync state
  public async clearOfflineData() {
    try {
      console.log('🧹 Clearing all offline data and resetting sync state...');
      
      // Stop any ongoing sync
      this.stopSync();
      
      // Clear all offline data
      await clearOfflineData();
      
      // Reset online state
      this.isOnline = navigator.onLine;
      
      console.log('✅ Offline data cleared and sync state reset');
    } catch (error) {
      console.error('❌ Error clearing offline data:', error);
      throw error;
    }
  }

  // Add these new methods to the SyncService class
  public async createProduct(product: Database['public']['Tables']['products']['Insert']) {
    try {
      const timestamp = new Date().toISOString();
      const productWithTimestamp = {
        ...product,
        created_at: timestamp,
        updated_at: timestamp
      };

      if (this.isOnline) {
        const { data, error } = await this.supabase
          .rpc('create_product', {
            p_product: productWithTimestamp
          });

        if (error) throw error;
        return data;
      } else {
        // Save product offline with timestamp
        return await saveOfflineProduct(productWithTimestamp);
      }
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  public async createProductsBatch(products: Database['public']['Tables']['products']['Insert'][]) {
    const { data, error } = await this.supabase
      .rpc('create_products_batch', {
        p_products: products
      });

    if (error) throw error;
    return data;
  }

  public async updateStockBatch(updates: Array<{ product_id: string; quantity_change: number }>) {
    const { data, error } = await this.supabase
      .rpc('update_stock_batch', {
        p_updates: updates
      });

    if (error) throw error;
    return data;
  }
}

// Create a singleton instance
export const syncService = new SyncService(); 