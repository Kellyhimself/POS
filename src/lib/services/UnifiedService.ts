import { getModeManager } from '@/lib/mode/ModeManager';
import { OnlineService } from './OnlineService';
import { OfflineService } from './OfflineService';
import { Database } from '@/types/supabase';

interface AppSettings {
  enable_vat_toggle_on_pos: boolean;
  vat_pricing_model: 'inclusive' | 'exclusive';
  default_vat_rate: number;
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  category?: string;
  store_id: string;
  quantity?: number;
  cost_price: number;
  selling_price: number;
  retail_price?: number;
  wholesale_price?: number;
  wholesale_threshold?: number;
  vat_status: boolean;
  unit_of_measure: string;
  units_per_pack: number;
  input_vat_amount?: number;
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

export class UnifiedService {
  private modeManager: ReturnType<typeof getModeManager>;
  private onlineService: OnlineService;
  private offlineService: OfflineService;

  constructor(modeManager: ReturnType<typeof getModeManager>) {
    this.modeManager = modeManager;
    this.onlineService = new OnlineService();
    this.offlineService = new OfflineService();
  }

  // Mode detection methods
  isOnlineMode(): boolean {
    return this.modeManager.isOnlineMode();
  }

  isOfflineMode(): boolean {
    return this.modeManager.isOfflineMode();
  }

  // Product methods
  async getProducts(storeId: string): Promise<Database['public']['Tables']['products']['Row'][]> {
    console.log('🔄 UnifiedService.getProducts: Fetching products for store:', storeId, 'mode:', this.modeManager.getCurrentMode());
    if (this.isOnlineMode()) {
      console.log('🔄 UnifiedService.getProducts: Using online service');
      const products = await this.onlineService.getProducts(storeId);
      console.log('✅ UnifiedService.getProducts: Online service returned:', products.length, 'products');
      return products;
    } else {
      console.log('🔄 UnifiedService.getProducts: Using offline service');
      const products = await this.offlineService.getProducts(storeId);
      console.log('✅ UnifiedService.getProducts: Offline service returned:', products.length, 'products');
      return products;
    }
  }

  async createProduct(productData: CreateProductInput): Promise<Database['public']['Tables']['products']['Row']> {
    // Handle SKU generation if not provided or empty
    const processedProductData = {
      ...productData,
      sku: productData.sku?.trim() || this.generateUniqueSku(productData.name),
      quantity: productData.quantity ?? 0 // Default to 0 quantity for new products
    };

    if (this.isOnlineMode()) {
      return await this.onlineService.createProduct(processedProductData);
    } else {
      return await this.offlineService.createProduct(processedProductData);
    }
  }

  private generateUniqueSku(productName: string): string {
    // Generate a unique SKU based on product name and timestamp
    const timestamp = Date.now().toString(36);
    const namePrefix = productName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6);
    return `${namePrefix}-${timestamp}`;
  }

  async updateProduct(productId: string, updates: Partial<Database['public']['Tables']['products']['Update']>): Promise<Database['public']['Tables']['products']['Row']> {
    if (this.isOnlineMode()) {
      return await this.onlineService.updateProduct(productId, updates);
    } else {
      return await this.offlineService.updateProduct(productId, updates);
    }
  }

  async updateStock(productId: string, quantityChange: number, version?: number): Promise<Database['public']['Tables']['products']['Row']> {
    if (this.isOnlineMode()) {
      return await this.onlineService.updateStock(productId, quantityChange, version || 1);
    } else {
      return await this.offlineService.updateStock(productId, quantityChange);
    }
  }

  // Transaction/Sales methods
  async getTransactions(storeId: string, startDate?: Date, endDate?: Date): Promise<Database['public']['Tables']['transactions']['Row'][]> {
    if (this.isOnlineMode()) {
      return await this.onlineService.getTransactions(storeId, startDate, endDate);
    } else {
      return await this.offlineService.getTransactions(storeId, startDate, endDate);
    }
  }

  async createSale(saleData: SaleInput): Promise<Database['public']['Tables']['transactions']['Row']> {
    if (this.isOnlineMode()) {
      return await this.onlineService.createSale(saleData);
    } else {
      return await this.offlineService.createSale(saleData);
    }
  }

  async submitToETIMS(invoiceData: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.isOnlineMode()) {
      return await this.onlineService.submitToETIMS(invoiceData);
    } else {
      return await this.offlineService.submitToETIMS(invoiceData);
    }
  }

  async getPendingETIMSSubmissions(storeId: string): Promise<Record<string, unknown>[]> {
    if (this.isOnlineMode()) {
      return await this.onlineService.getPendingETIMSSubmissions(storeId);
    } else {
      return await this.offlineService.getPendingETIMSSubmissions(storeId);
    }
  }

  async syncPendingETIMSSubmissions(storeId: string): Promise<{ success: boolean; error?: string }> {
    if (this.isOnlineMode()) {
      return await this.onlineService.syncPendingETIMSSubmissions(storeId);
    } else {
      return await this.offlineService.syncPendingETIMSSubmissions(storeId);
    }
  }

  // Note: getSalesReport and getAllSalesReport are only available in offline mode
  // For online mode, we'll need to implement these or use a different approach
  async getSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<unknown[]> {
    if (this.isOnlineMode()) {
      // Use the new online implementation
      return await this.onlineService.getSalesReport(storeId, startDate, endDate);
    } else {
      return await this.offlineService.getSalesReport(storeId, startDate, endDate);
    }
  }

  async getAllSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<unknown[]> {
    if (this.isOnlineMode()) {
      // Use the new online implementation
      return await this.onlineService.getAllSalesReport(storeId, startDate, endDate);
    } else {
      return await this.offlineService.getAllSalesReport(storeId, startDate, endDate);
    }
  }

  // Additional report methods needed for the reports page
  async generateReports(storeId: string, startDate: Date, endDate: Date): Promise<unknown[]> {
    if (this.isOnlineMode()) {
      // For online mode, use getSalesReport to filter out VATable products with 0 VAT
      const data = await this.getSalesReport(storeId, startDate, endDate);
      return [{ data }];
    } else {
      const data = await this.offlineService.getSalesReport(storeId, startDate, endDate);
      return [{ data }];
    }
  }

  async generateInventoryReport(storeId: string): Promise<unknown[]> {
    if (this.isOnlineMode()) {
      // For online mode, get products and transform them
      const products = await this.getProducts(storeId);
      return [{
        data: products.map(product => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          quantity: product.quantity,
          low_stock: product.quantity <= 10,
          retail_price: product.selling_price,
          wholesale_price: product.wholesale_price,
          wholesale_threshold: product.wholesale_threshold
        }))
      }];
    } else {
      // Use the existing offline method
      const { getStockReport } = await import('@/lib/db/index');
      const products = await getStockReport(storeId);
      return [{
        data: products.map(product => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          quantity: product.quantity,
          low_stock: product.quantity <= 10,
          retail_price: product.selling_price,
          wholesale_price: product.wholesale_price,
          wholesale_threshold: product.wholesale_threshold
        }))
      }];
    }
  }

  async generateInputVatReport(storeId: string, startDate: Date, endDate: Date): Promise<unknown[]> {
    if (this.isOnlineMode()) {
      // For online mode, get all purchases with input VAT > 0
      const purchases = await this.onlineService.getInputVatSubmissions(storeId, startDate, endDate);
      
      return [{
        data: purchases.flatMap((purchase: Record<string, unknown>) => {
          const purchaseItems = purchase.purchase_items as Array<Record<string, unknown>> || [];
          
          return purchaseItems.map((item: Record<string, unknown>) => {
            const product = item.products as Record<string, unknown> || {};
            return {
              id: `${purchase.id}-${item.id}`,
              invoice_number: purchase.invoice_number as string,
              total: (item.unit_cost as number || 0) * (item.quantity as number || 0),
              vat_amount: item.vat_amount as number || 0,
              timestamp: purchase.date as string,
              submission_type: 'input_vat',
              products: {
                name: product.name as string || 'Unknown Product',
                sku: product.sku as string || null,
                selling_price: null,
                vat_status: product.vat_status as boolean || false,
                category: product.category as string || 'Purchase',
                cost_price: product.cost_price as number || 0
              }
            };
          });
        })
      }];
    } else {
      // For offline mode, get all purchases with input VAT > 0
      const purchases = await this.offlineService.getInputVatSubmissions(storeId, startDate, endDate);
      
      return [{
        data: purchases.flatMap((purchase: Record<string, unknown>) => {
          const purchaseItems = purchase.purchase_items as Array<Record<string, unknown>> || [];
          
          return purchaseItems.map((item: Record<string, unknown>) => {
            const product = item.products as Record<string, unknown> || {};
            return {
              id: `${purchase.id}-${item.id}`,
              invoice_number: purchase.invoice_number as string,
              total: (item.unit_cost as number || 0) * (item.quantity as number || 0),
              vat_amount: item.vat_amount as number || 0,
              timestamp: purchase.date as string,
              submission_type: 'input_vat',
              products: {
                name: product.name as string || 'Unknown Product',
                sku: product.sku as string || null,
                selling_price: null,
                vat_status: product.vat_status as boolean || false,
                category: product.category as string || 'Purchase',
                cost_price: product.cost_price as number || 0
              }
            };
          });
        })
      }];
    }
  }

  async generalReport(storeId: string, startDate: Date, endDate: Date): Promise<unknown[]> {
    if (this.isOnlineMode()) {
      // For online mode, use the new getAllSalesReport implementation
      const data = await this.getAllSalesReport(storeId, startDate, endDate);
      return [{ data }];
    } else {
      const data = await this.offlineService.getAllSalesReport(storeId, startDate, endDate);
      return [{ data }];
    }
  }

  // Real-time subscription methods
  subscribeToProducts(storeId: string, callback: (payload: Record<string, unknown>) => void): unknown {
    if (this.isOnlineMode()) {
      return this.onlineService.subscribeToProducts(storeId, callback);
    } else {
      // Offline mode doesn't support real-time subscriptions
      return null;
    }
  }

  subscribeToTransactions(storeId: string, callback: (payload: Record<string, unknown>) => void): unknown {
    if (this.isOnlineMode()) {
      return this.onlineService.subscribeToTransactions(storeId, callback);
    } else {
      // Offline mode doesn't support real-time subscriptions
      return null;
    }
  }

  // Sync methods
  async getPendingSyncCount(): Promise<number> {
    if (this.isOfflineMode()) {
      return await this.offlineService.getPendingSyncCount();
    }
    return 0;
  }

  async syncPendingData(): Promise<void> {
    if (this.isOfflineMode()) {
      return await this.offlineService.syncPendingData();
    }
  }

  async clearOfflineData(): Promise<void> {
    if (this.isOfflineMode()) {
      return await this.offlineService.clearOfflineData();
    } else {
      console.warn('clearOfflineData called in online mode - no action taken');
    }
  }

  async getAppSettings(): Promise<AppSettings> {
    if (this.isOnlineMode()) {
      return await this.onlineService.getAppSettings();
    } else {
      return await this.offlineService.getAppSettings();
    }
  }

  async updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
    if (this.isOnlineMode()) {
      return await this.onlineService.updateAppSettings(settings);
    } else {
      return await this.offlineService.updateAppSettings(settings);
    }
  }

  // Purchase methods
  async getPurchases(storeId: string, startDate?: Date, endDate?: Date): Promise<Array<Database['public']['Tables']['purchases']['Row'] & { items: Database['public']['Tables']['purchase_items']['Row'][]; supplier_name?: string }>> {
    if (this.isOnlineMode()) {
      return await this.onlineService.getPurchases(storeId, startDate, endDate);
    } else {
      return await this.offlineService.getPurchases(storeId, startDate, endDate);
    }
  }

  async createPurchase(purchaseData: PurchaseInput): Promise<Database['public']['Tables']['purchases']['Row'] & { items: Database['public']['Tables']['purchase_items']['Row'][] }> {
    if (this.isOnlineMode()) {
      return await this.onlineService.createPurchase(purchaseData);
    } else {
      return await this.offlineService.createPurchase(purchaseData);
    }
  }
}

// Singleton instance
let unifiedServiceInstance: UnifiedService | null = null;

export function getUnifiedService(modeManager?: ReturnType<typeof getModeManager>): UnifiedService {
  if (!unifiedServiceInstance) {
    const manager = modeManager || getModeManager();
    unifiedServiceInstance = new UnifiedService(manager);
  }
  return unifiedServiceInstance;
}

export function destroyUnifiedService(): void {
  if (unifiedServiceInstance) {
    unifiedServiceInstance = null;
  }
}

