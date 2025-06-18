import { createClient } from '@/lib/supabase-clients/pages';
import { 
  cacheProducts, 
  getCachedProducts,
  saveOfflineSale,
  processSyncQueue,
  getSalesReport,
  saveOfflineProduct,
  db,
  clearOfflineData,
  updateOfflineStockQuantity,
  getAllSalesReport
} from '@/lib/db/index';
import { Database } from '@/types/supabase';
import { submitEtimsInvoice, EtimsInvoice } from '@/lib/etims/utils';

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
      
      // Sync sales only
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
          console.log('🔄 Calling create_sale RPC...with p_timestamp:', transaction.timestamp);
          const { data: transactionId, error } = await this.supabase
            .rpc('create_sale', {
              p_store_id: transaction.store_id,
              p_products: products,
              p_payment_method: transaction.payment_method,
              p_total_amount: transaction.total_amount,
              p_vat_total: transaction.vat_total,
              p_is_sync: true,
              p_timestamp: transaction.timestamp
            });

          if (error) {
            console.error('❌ create_sale RPC error:', {
              error: error.message,
              details: error.details
            });
            throw error;
          }

          // Only mark transaction as synced after successful server sync
          await db.transactions.update(transaction.id, { synced: true });
          console.log('✅ Transaction synced successfully:', {
            transaction_id: transaction.id,
            store_id: transaction.store_id,
            server_transaction_id: transactionId
          });

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
  public async saveSale(sale: SaleInput & { timestamp?: string }) {
    try {
      console.log('🔄 Starting saveSale process:', {
        store_id: sale.store_id,
        total_amount: sale.total_amount,
        product_count: sale.products.length,
        timestamp: sale.timestamp,
        products: sale.products.map(p => ({
          id: p.id,
          quantity: p.quantity,
          displayPrice: p.displayPrice
        }))
      });

      // Create timestamp in Kenya timezone
      const keTime = new Date();
      const timestamp = sale.timestamp || keTime.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' });

      // Always save locally first
      const offlineSale = await saveOfflineSale({
        ...sale
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

      return offlineSale;
    } catch (error) {
      console.error('❌ Error saving sale:', error);
      throw error;
    }
  }

  // Update stock (works offline)
  public async updateStock(productId: string, localQuantity: number) {
    try {
      // Always update offline first and mark as needing sync
        console.log('📊 Updating stock offline:', {
          product_id: productId,
          quantity: localQuantity
        });
      
      const updatedProduct = await updateOfflineStockQuantity(productId, localQuantity);
      
      // Mark the product as needing sync
      await db.products.update(productId, { 
        synced: false 
      });
      
      return updatedProduct;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  // Submit to eTIMS (works offline)
  public async submitToETIMS(submission: {
    store_id: string;
    invoice_number: string;
    data: EtimsInvoice;
  }) {
    try {
      // Use the consolidated submitEtimsInvoice function
      const { data, error } = await submitEtimsInvoice(submission.data);
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving eTIMS submission:', error);
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
      const [sales] = await Promise.all([
        getSalesReport(store_id, startDate, endDate)
      ]);

      // Transform sales data to match the expected format
      const transformedSales = {
        data: sales.map(sale => ({
          id: sale.id,
          product_id: sale.product_id,
          quantity: sale.quantity,
          total: sale.total,
          vat_amount: sale.vat_amount,
          payment_method: sale.payment_method,
          timestamp: sale.timestamp,
          sale_mode: sale.sale_mode,
          products: sale.products
        }))
      };

      return transformedSales;
    } catch (error) {
      console.error('Error generating reports:', error);
      throw error;
    }
  }

  // Get stock report (works offline)
  public async getStockReport(store_id: string) {
    try {
      // Get all products for the store
      const products = await db.products
        .where('store_id')
        .equals(store_id)
        .toArray();

      // Transform the data to match the expected format
      const transformedData = {
        data: products.map(product => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          quantity: product.quantity,
          low_stock: product.quantity <= 10, // Using constant threshold like in inventory page
          retail_price: product.selling_price,
          wholesale_price: product.wholesale_price,
          wholesale_threshold: product.wholesale_threshold
        }))
      };

      return transformedData;
    } catch (error) {
      console.error('Error getting stock report:', error);
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
      cost_price: number;
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
          category,
          cost_price
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
     // Save product offline with timestamp
      return await saveOfflineProduct(productWithTimestamp);
      
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

  public async createSale(sale: {
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
    timestamp: string;
  }) {
    try {
      // Log the exact data being sent to RPC
      console.log('📤 [SyncService] Calling create_sale RPC with data:', {
        store_id: sale.store_id,
        products: sale.products,
        payment_method: sale.payment_method,
        total_amount: sale.total_amount,
        vat_total: sale.vat_total,
        timestamp: sale.timestamp,
        timestamp_details: {
          original: sale.timestamp,
          parsed: new Date(sale.timestamp).toISOString(),
          local_ke: new Date(sale.timestamp).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
          utc: new Date(sale.timestamp).toUTCString()
        }
      });

      const { data, error } = await this.supabase
        .rpc('create_sale', {
          p_store_id: sale.store_id,
          p_products: sale.products,
          p_payment_method: sale.payment_method,
          p_total_amount: sale.total_amount,
          p_vat_total: sale.vat_total,
          p_is_sync: true,
          p_timestamp: sale.timestamp
        });

      if (error) {
        console.error('❌ [SyncService] Error in create_sale RPC:', {
          error: error.message,
          details: error.details,
          timestamp: sale.timestamp
        });
        throw error;
      }

      console.log('✅ [SyncService] create_sale RPC successful:', {
        transaction_id: data,
        timestamp: sale.timestamp
      });

      return { data, error: null };
    } catch (error) {
      console.error('❌ [SyncService] Error creating sale:', error);
      return { data: null, error };
    }
  }

  public async getTransaction(transactionId: string) {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error getting transaction:', error);
      return { data: null, error };
    }
  }

  public async createPurchase(
    purchase: Database['public']['Tables']['purchases']['Row'],
    items: Database['public']['Tables']['purchase_items']['Row'][]
  ) {
    try {
      // Remove 'synced' property if present
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { synced: _, ...purchaseToSend } = purchase as unknown as { [key: string]: unknown };
      
      // Check if supplier_id exists in Supabase, if not set to null to avoid foreign key constraint
      if (purchaseToSend.supplier_id) {
        const { data: supplierExists } = await this.supabase
          .from('suppliers')
          .select('id')
          .eq('id', purchaseToSend.supplier_id)
          .maybeSingle();
        
        if (!supplierExists) {
          console.warn(`⚠️ [SyncService] Supplier ${purchaseToSend.supplier_id} not found in Supabase, setting supplier_id to null`);
          purchaseToSend.supplier_id = null;
        }
      }
      
      const { data: purchaseData, error: purchaseError } = await this.supabase
        .from('purchases')
        .upsert([purchaseToSend], { onConflict: 'id' });
      if (purchaseError) {
        console.error('❌ [SyncService] Error inserting purchase:', purchaseError);
        throw purchaseError;
      }
      // Insert purchase items
      if (items.length > 0) {
        const itemsToSend = items.map(item => {
          if ('synced' in item) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { synced: _, ...rest } = item as { [key: string]: unknown };
            return rest;
          }
          return item;
        });
        const { error: itemsError } = await this.supabase
          .from('purchase_items')
          .insert(itemsToSend);
        if (itemsError) {
          console.error('❌ [SyncService] Error inserting purchase items:', itemsError);
          throw itemsError;
        }
      }
      // Mark local purchase and items as synced
      if (purchase.id) {
        await db.purchases.update(purchase.id, { synced: true });
        await db.purchase_items.where('purchase_id').equals(purchase.id).modify({ synced: true });
      }
      return { data: purchaseData, error: null };
    } catch (error) {
      console.error('❌ [SyncService] Error in createPurchase:', error);
      throw error;
    }
  }

  public async getAllSalesReport(store_id: string, startDate: Date, endDate: Date) {
    return await getAllSalesReport(store_id, startDate, endDate);
  }
}

// Create a singleton instance
export const syncService = new SyncService(); 