import { 
  saveOfflineSale, 
  saveOfflineProduct, 
  updateOfflineStockQuantity,
  getCachedProducts,
  getPendingTransactions,
  processSyncQueue,
  db,
  saveOfflineETIMSSubmission,
  getSalesReport,
  getAllSalesReport
} from '@/lib/db/index';
import { Database } from '@/types/supabase';

export interface SaleInput {
  store_id: string;
  user_id: string;
  products: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    vat_amount: number;
  }>;
  payment_method: 'cash' | 'mpesa';
  total_amount: number;
  vat_total: number;
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  category?: string;
  store_id: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  vat_status: boolean;
  unit_of_measure: string;
  units_per_pack: number;
  retail_price?: number;
  wholesale_price?: number;
  wholesale_threshold?: number;
  input_vat_amount?: number;
}

export class OfflineService {
  // Product operations
  async getProducts(storeId: string): Promise<Database['public']['Tables']['products']['Row'][]> {
    try {
      const products = await getCachedProducts(storeId);
      return products.map(product => ({
        ...product,
        // Remove offline-specific fields
        synced: undefined
      }));
    } catch (error) {
      console.error('Error fetching offline products:', error);
      throw error;
    }
  }

  async createProduct(productData: CreateProductInput): Promise<Database['public']['Tables']['products']['Row']> {
    try {
      const offlineProduct = await saveOfflineProduct({
        ...productData,
        id: crypto.randomUUID(), // Generate local ID
        synced: false
      });

      return {
        ...offlineProduct,
        synced: undefined
      };
    } catch (error) {
      console.error('Error creating offline product:', error);
      throw error;
    }
  }

  async updateProduct(productId: string, updates: Partial<Database['public']['Tables']['products']['Update']>): Promise<Database['public']['Tables']['products']['Row']> {
    try {
      // Get current product
      const currentProduct = await db.products.get(productId);
      if (!currentProduct) {
        throw new Error('Product not found');
      }

      // Update product
      const updatedProduct = { ...currentProduct, ...updates, synced: false };
      await db.products.update(productId, updatedProduct);

      return {
        ...updatedProduct,
        synced: undefined
      };
    } catch (error) {
      console.error('Error updating offline product:', error);
      throw error;
    }
  }

  async updateStock(productId: string, quantityChange: number): Promise<Database['public']['Tables']['products']['Row']> {
    try {
      // Use existing offline stock update function
      await updateOfflineStockQuantity(productId, quantityChange);

      // Get updated product
      const updatedProduct = await db.products.get(productId);
      if (!updatedProduct) {
        throw new Error('Product not found after update');
      }

      return {
        ...updatedProduct,
        synced: undefined
      };
    } catch (error) {
      console.error('Error updating offline stock:', error);
      throw error;
    }
  }

  // Sale operations
  async createSale(saleData: SaleInput): Promise<Database['public']['Tables']['transactions']['Row']> {
    try {
      // Convert to offline sale format
      const offlineSale = await saveOfflineSale({
        store_id: saleData.store_id,
        products: saleData.products.map(p => ({
          id: p.id,
          quantity: p.quantity,
          displayPrice: p.unit_price,
          vat_amount: p.vat_amount
        })),
        payment_method: saleData.payment_method,
        total_amount: saleData.total_amount,
        vat_total: saleData.vat_total
      });

      // Return in online format
      return {
        id: offlineSale.id,
        store_id: saleData.store_id,
        user_id: saleData.user_id,
        total: saleData.total_amount,
        vat_amount: saleData.vat_total,
        payment_method: saleData.payment_method,
        timestamp: new Date().toISOString(),
        synced: false,
        created_at: new Date().toISOString()
      } as Database['public']['Tables']['transactions']['Row'];
    } catch (error) {
      console.error('Error creating offline sale:', error);
      throw error;
    }
  }

  async getTransactions(storeId: string, startDate?: Date, endDate?: Date): Promise<Database['public']['Tables']['transactions']['Row'][]> {
    try {
      // Get all transactions from offline storage
      const transactions = await db.transactions
        .where('store_id')
        .equals(storeId)
        .toArray();

      // Filter by date if provided
      let filteredTransactions = transactions;
      if (startDate && endDate) {
        filteredTransactions = transactions.filter(t => {
          const transactionDate = new Date(t.created_at);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
      }

      // Convert to online format
      return filteredTransactions.map(t => ({
        id: t.id,
        store_id: t.store_id,
        user_id: '', // Offline doesn't track user_id
        total: t.total_amount,
        vat_amount: t.vat_total,
        payment_method: t.payment_method,
        timestamp: t.timestamp,
        synced: t.synced,
        created_at: t.created_at
      })) as Database['public']['Tables']['transactions']['Row'][];
    } catch (error) {
      console.error('Error fetching offline transactions:', error);
      throw error;
    }
  }

  // Sync operations
  async syncPendingData(): Promise<void> {
    try {
      await processSyncQueue();
    } catch (error) {
      console.error('Error syncing pending data:', error);
      throw error;
    }
  }

  async getPendingSyncCount(): Promise<number> {
    try {
      const pendingProducts = await db.products
        .where('synced')
        .equals(false)
        .count();

      const pendingTransactions = await db.transactions
        .where('synced')
        .equals(false)
        .count();

      return pendingProducts + pendingTransactions;
    } catch (error) {
      console.error('Error getting pending sync count:', error);
      return 0;
    }
  }

  // eTIMS operations
  async submitToETIMS(invoiceData: any): Promise<any> {
    try {
      const submission = await saveOfflineETIMSSubmission({
        store_id: invoiceData.store_id,
        invoice_number: invoiceData.invoice_number,
        data: invoiceData,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        submission_type: 'invoice'
      });

      return {
        id: submission.id,
        status: 'pending',
        synced: false
      };
    } catch (error) {
      console.error('Error submitting offline eTIMS:', error);
      throw error;
    }
  }

  // Reports
  async getSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      return await getSalesReport(storeId, startDate, endDate);
    } catch (error) {
      console.error('Error getting offline sales report:', error);
      throw error;
    }
  }

  async getAllSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      return await getAllSalesReport(storeId, startDate, endDate);
    } catch (error) {
      console.error('Error getting offline all sales report:', error);
      throw error;
    }
  }

  // Utility methods
  async clearOfflineData(): Promise<void> {
    try {
      await db.clear();
    } catch (error) {
      console.error('Error clearing offline data:', error);
      throw error;
    }
  }

  async getOfflineDataSize(): Promise<number> {
    try {
      const products = await db.products.count();
      const transactions = await db.transactions.count();
      const saleItems = await db.sale_items.count();
      
      return products + transactions + saleItems;
    } catch (error) {
      console.error('Error getting offline data size:', error);
      return 0;
    }
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      // Try to access the database
      await db.products.count();
      return true;
    } catch (error) {
      console.error('Offline service health check failed:', error);
      return false;
    }
  }
}

// Create a singleton instance
export const offlineService = new OfflineService(); 