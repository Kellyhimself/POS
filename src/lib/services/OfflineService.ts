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
  getAllSalesReport,
  saveOfflinePurchase,
  OfflinePurchase,
  OfflinePurchaseItem
} from '@/lib/db/index';
import { Database } from '@/types/supabase';

interface AppSettings {
  enable_vat_toggle_on_pos: boolean;
  vat_pricing_model: 'inclusive' | 'exclusive';
  default_vat_rate: number;
}

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

export interface PurchaseInput {
  store_id: string;
  supplier_id?: string;
  supplier_name: string;
  invoice_number: string;
  supplier_vat_no: string;
  is_vat_included: boolean;
  input_vat_amount: number;
  total_amount: number;
  date: string;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_cost: number;
    vat_amount: number;
  }>;
}

export class OfflineService {
  // Product operations
  async getProducts(storeId: string): Promise<Database['public']['Tables']['products']['Row'][]> {
    try {
      console.log('🔄 OfflineService.getProducts: Fetching products for store:', storeId);
      const products = await getCachedProducts(storeId);
      const mappedProducts = products.map(product => ({
        ...product,
        // Remove offline-specific fields
        synced: undefined
      }));
      console.log('✅ OfflineService.getProducts: Returning products:', mappedProducts.length, 'products');
      console.log('📊 OfflineService.getProducts: Product quantities:', 
        mappedProducts.map(p => ({ id: p.id, name: p.name, quantity: p.quantity }))
      );
      return mappedProducts;
    } catch (error) {
      console.error('❌ OfflineService.getProducts: Error fetching offline products:', error);
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
      console.log('🔄 OfflineService: Creating sale:', {
        store_id: saleData.store_id,
        product_count: saleData.products.length,
        total_amount: saleData.total_amount,
        vat_total: saleData.vat_total
      });

      // Convert to offline sale format and save
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

      console.log('✅ OfflineService: Sale created successfully:', {
        sale_id: offlineSale.id,
        items_count: offlineSale.items.length
      });

      // Return in online format - match the current database schema
      return {
        id: offlineSale.id,
        store_id: saleData.store_id,
        product_id: null, // Multi-product sale, no single product_id
        quantity: saleData.products.reduce((sum, p) => sum + p.quantity, 0),
        total: saleData.total_amount,
        vat_amount: saleData.vat_total,
        payment_method: saleData.payment_method,
        timestamp: new Date().toISOString(),
        synced: false
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
          const transactionDate = new Date(t.timestamp);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
      }

      // Convert to online format - match the current database schema
      return filteredTransactions.map(t => ({
        id: t.id,
        store_id: t.store_id,
        product_id: null, // Offline doesn't track individual products in transactions
        quantity: 0, // Will be calculated from sale_items
        total: t.total_amount,
        vat_amount: t.vat_total,
        payment_method: t.payment_method,
        timestamp: t.timestamp,
        synced: t.synced
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
      // Save to offline storage for later sync
      const submission = await saveOfflineETIMSSubmission({
        store_id: invoiceData.store_id,
        invoice_number: invoiceData.invoice_number,
        data: invoiceData,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        submission_type: 'invoice'
      });

      return submission;
    } catch (error) {
      console.error('Error saving offline ETIMS submission:', error);
      throw error;
    }
  }

  async getPendingETIMSSubmissions(storeId: string): Promise<Record<string, unknown>[]> {
    try {
      const submissions = await db.etims_submissions
        .where('store_id')
        .equals(storeId)
        .and(submission => submission.status === 'pending')
        .toArray();

      return submissions;
    } catch (error) {
      console.error('Error fetching offline ETIMS submissions:', error);
      throw error;
    }
  }

  async getInputVatSubmissions(storeId: string, startDate: Date, endDate: Date): Promise<Record<string, unknown>[]> {
    try {
      console.log('🔍 OfflineService: Fetching input VAT from purchases:', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const purchases = await db.purchases
        .where('store_id')
        .equals(storeId)
        .and(purchase => {
          if (purchase.input_vat_amount <= 0) return false;
          
          const purchaseDate = new Date(purchase.date);
          return purchaseDate >= startDate && purchaseDate <= endDate;
        })
        .toArray();

      // Get purchase items for each purchase
      const purchasesWithItems = await Promise.all(
        purchases.map(async (purchase) => {
          const items = await db.purchase_items
            .where('purchase_id')
            .equals(purchase.id)
            .toArray();

          // Get product details for each item
          const itemsWithProducts = await Promise.all(
            items.map(async (item) => {
              const product = await db.products.get(item.product_id);
              return {
                ...item,
                products: product || {
                  name: 'Unknown Product',
                  sku: null,
                  category: null,
                  cost_price: 0,
                  vat_status: false
                }
              };
            })
          );

          return {
            ...purchase,
            purchase_items: itemsWithProducts
          };
        })
      );

      console.log('🔍 OfflineService: Input VAT purchases found:', {
        count: purchasesWithItems.length,
        purchases: purchasesWithItems.map(p => ({
          id: p.id,
          invoice_number: p.invoice_number,
          date: p.date,
          input_vat_amount: p.input_vat_amount,
          total_amount: p.total_amount
        }))
      });

      return purchasesWithItems;
    } catch (error) {
      console.error('Error fetching offline input VAT from purchases:', error);
      return [];
    }
  }

  async syncPendingETIMSSubmissions(storeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const pendingSubmissions = await this.getPendingETIMSSubmissions(storeId);
      
      for (const submission of pendingSubmissions) {
        try {
          // Submit to KRA eTIMS API
          const response = await fetch('/api/etims/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              invoiceData: submission.data,
              store_id: storeId 
            })
          });

          if (response.ok) {
            // Mark as synced
            await db.etims_submissions.update(submission.id, { status: 'synced' });
          }
        } catch (error) {
          console.error('Error syncing ETIMS submission:', error);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error in offline ETIMS sync:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

  // Purchase operations
  async getPurchases(storeId: string, startDate?: Date, endDate?: Date): Promise<Array<OfflinePurchase & { items: OfflinePurchaseItem[]; supplier_name?: string }>> {
    try {
      // Get all purchases from offline storage
      const purchases = await db.purchases
        .where('store_id')
        .equals(storeId)
        .toArray();

      // Filter by date if provided
      let filteredPurchases = purchases;
      if (startDate && endDate) {
        // Convert dates to YYYY-MM-DD format for comparison
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        filteredPurchases = purchases.filter(p => {
          // Extract date part from purchase date (remove time and timezone)
          const purchaseDateStr = p.date.split('T')[0];
          return purchaseDateStr >= startDateStr && purchaseDateStr <= endDateStr;
        });
      }

      // Get items and supplier names for each purchase
      const purchasesWithItems = await Promise.all(
        filteredPurchases.map(async (purchase) => {
          const items = await db.purchase_items.where('purchase_id').equals(purchase.id).toArray();
          
          // Get supplier name
          let supplier_name = '';
          if (purchase.supplier_id) {
            const supplier = await db.suppliers?.get(purchase.supplier_id);
            supplier_name = supplier?.name || '';
          }
          // Fallback to purchase.supplier_name if no supplier_id
          if (!supplier_name && purchase.supplier_name) {
            supplier_name = purchase.supplier_name;
          }

          return { ...purchase, items, supplier_name };
        })
      );

      return purchasesWithItems;
    } catch (error) {
      console.error('Error fetching offline purchases:', error);
      throw error;
    }
  }

  async createPurchase(purchaseData: PurchaseInput): Promise<OfflinePurchase & { items: OfflinePurchaseItem[] }> {
    try {
      console.log('🔄 OfflineService: Creating purchase:', {
        store_id: purchaseData.store_id,
        supplier_name: purchaseData.supplier_name,
        total_amount: purchaseData.total_amount,
        items_count: purchaseData.items.length
      });

      // Convert to offline purchase format and save
      const offlinePurchase = await saveOfflinePurchase(
        {
          store_id: purchaseData.store_id,
          supplier_id: purchaseData.supplier_id || null,
          supplier_name: purchaseData.supplier_name,
          invoice_number: purchaseData.invoice_number,
          supplier_vat_no: purchaseData.supplier_vat_no,
          is_vat_included: purchaseData.is_vat_included,
          input_vat_amount: purchaseData.input_vat_amount,
          total_amount: purchaseData.total_amount,
          date: purchaseData.date,
          notes: purchaseData.notes || '',
        },
        purchaseData.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          vat_amount: item.vat_amount,
        }))
      );

      console.log('✅ OfflineService: Purchase created successfully:', {
        purchase_id: offlinePurchase.id,
        items_count: offlinePurchase.items.length
      });

      return offlinePurchase;
    } catch (error) {
      console.error('Error creating offline purchase:', error);
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

  async getAppSettings(): Promise<AppSettings> {
    try {
      const settings = await db.app_settings.get('global');
      if (settings) {
        return settings;
      }
      
      // If no settings found, return default settings
      console.log('⚠️ No app settings found in offline database, using defaults');
      const defaultSettings: AppSettings = {
        enable_vat_toggle_on_pos: true,
        vat_pricing_model: 'exclusive',
        default_vat_rate: 16
      };
      
      // Save default settings to database for future use
      await db.app_settings.put({
        id: 'global',
        ...defaultSettings,
        enable_etims_integration: false,
        synced: false,
        updated_at: new Date().toISOString()
      });
      
      return defaultSettings;
    } catch (error) {
      console.error('Error fetching offline app settings:', error);
      // Return default settings even if there's an error
      console.log('⚠️ Error fetching app settings, using defaults');
      return {
        enable_vat_toggle_on_pos: true,
        vat_pricing_model: 'exclusive',
        default_vat_rate: 16
      };
    }
  }

  async updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      const current = await db.app_settings.get('global');
      const updatedSettings = {
        id: 'global',
        enable_vat_toggle_on_pos: true,
        vat_pricing_model: 'exclusive' as const,
        default_vat_rate: 16,
        enable_etims_integration: false,
        synced: false,
        updated_at: new Date().toISOString(),
        ...current,
        ...settings
      };
      await db.app_settings.put(updatedSettings);
    } catch (error) {
      console.error('Error updating offline app settings:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const offlineService = new OfflineService(); 