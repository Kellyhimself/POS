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
  getETIMSReport
} from '@/lib/db';
import { Database } from '@/types/supabase';

type Product = Database['public']['Tables']['products']['Row'];
type Sale = Database['public']['Tables']['transactions']['Row'];
type StockUpdate = {
  product_id: string;
  store_id: string;
  quantity_change: number;
};

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
      await processSyncQueue();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  // Save a sale (works offline)
  public async saveSale(sale: Omit<Sale, 'id' | 'timestamp' | 'synced'>) {
    try {
      // Save locally first
      const offlineSale = await saveOfflineSale(sale);

      // If online, try to sync immediately
      if (this.isOnline) {
        const { data, error } = await this.supabase
          .from('transactions')
          .insert(sale)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      return offlineSale;
    } catch (error) {
      console.error('Error saving sale:', error);
      throw error;
    }
  }

  // Update stock (works offline)
  public async updateStock(update: StockUpdate) {
    try {
      // Save locally first
      const offlineUpdate = await saveOfflineStockUpdate(update);

      // If online, try to sync immediately
      if (this.isOnline) {
        const { data, error } = await this.supabase
          .rpc('update_stock', {
            p_product_id: update.product_id,
            p_quantity_change: update.quantity_change,
            p_store_id: update.store_id
          });

        if (error) throw error;
        return data;
      }

      return offlineUpdate;
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
}

// Create a singleton instance
export const syncService = new SyncService(); 