import { ModeManager } from '@/lib/mode/ModeManager';
import { OnlineService, SaleInput as OnlineSaleInput, CreateProductInput as OnlineCreateProductInput } from './OnlineService';
import { OfflineService, SaleInput as OfflineSaleInput, CreateProductInput as OfflineCreateProductInput } from './OfflineService';
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

export class UnifiedService {
  private modeManager: ModeManager;
  private onlineService: OnlineService;
  private offlineService: OfflineService;

  constructor(modeManager: ModeManager) {
    this.modeManager = modeManager;
    this.onlineService = new OnlineService();
    this.offlineService = new OfflineService();
  }

  // Product operations
  async getProducts(storeId: string): Promise<Database['public']['Tables']['products']['Row'][]> {
    const currentMode = this.modeManager.getCurrentMode();
    console.log(`🔄 Getting products in ${currentMode} mode`);

    try {
      if (this.modeManager.isOnlineMode()) {
        return await this.onlineService.getProducts(storeId);
      } else {
        return await this.offlineService.getProducts(storeId);
      }
    } catch (error) {
      console.error(`Error getting products in ${currentMode} mode:`, error);
      
      // Fallback to offline mode if online fails
      if (this.modeManager.isOnlineMode()) {
        console.log('🔄 Falling back to offline mode for products');
        return await this.offlineService.getProducts(storeId);
      }
      
      throw error;
    }
  }

  async createProduct(productData: CreateProductInput): Promise<Database['public']['Tables']['products']['Row']> {
    const currentMode = this.modeManager.getCurrentMode();
    console.log(`🔄 Creating product in ${currentMode} mode`);

    try {
      if (this.modeManager.isOnlineMode()) {
        return await this.onlineService.createProduct(productData as OnlineCreateProductInput);
      } else {
        return await this.offlineService.createProduct(productData as OfflineCreateProductInput);
      }
    } catch (error) {
      console.error(`Error creating product in ${currentMode} mode:`, error);
      
      // Fallback to offline mode if online fails
      if (this.modeManager.isOnlineMode()) {
        console.log('🔄 Falling back to offline mode for product creation');
        return await this.offlineService.createProduct(productData as OfflineCreateProductInput);
      }
      
      throw error;
    }
  }

  async updateProduct(productId: string, updates: Partial<Database['public']['Tables']['products']['Update']>): Promise<Database['public']['Tables']['products']['Row']> {
    const currentMode = this.modeManager.getCurrentMode();
    console.log(`🔄 Updating product in ${currentMode} mode`);

    try {
      if (this.modeManager.isOnlineMode()) {
        return await this.onlineService.updateProduct(productId, updates);
      } else {
        return await this.offlineService.updateProduct(productId, updates);
      }
    } catch (error) {
      console.error(`Error updating product in ${currentMode} mode:`, error);
      
      // Fallback to offline mode if online fails
      if (this.modeManager.isOnlineMode()) {
        console.log('🔄 Falling back to offline mode for product update');
        return await this.offlineService.updateProduct(productId, updates);
      }
      
      throw error;
    }
  }

  async updateStock(productId: string, quantityChange: number, version?: number): Promise<Database['public']['Tables']['products']['Row']> {
    const currentMode = this.modeManager.getCurrentMode();
    console.log(`🔄 Updating stock in ${currentMode} mode`);

    try {
      if (this.modeManager.isOnlineMode()) {
        return await this.onlineService.updateStock(productId, quantityChange, version || 1);
      } else {
        return await this.offlineService.updateStock(productId, quantityChange);
      }
    } catch (error) {
      console.error(`Error updating stock in ${currentMode} mode:`, error);
      
      // Handle optimistic locking conflicts
      if (error.message?.includes('CONFLICT')) {
        throw new Error('Product has been modified by another user. Please refresh and try again.');
      }
      
      // Fallback to offline mode if online fails
      if (this.modeManager.isOnlineMode()) {
        console.log('🔄 Falling back to offline mode for stock update');
        return await this.offlineService.updateStock(productId, quantityChange);
      }
      
      throw error;
    }
  }

  // Sale operations
  async createSale(saleData: SaleInput): Promise<Database['public']['Tables']['transactions']['Row']> {
    const currentMode = this.modeManager.getCurrentMode();
    console.log(`🔄 Creating sale in ${currentMode} mode`);

    try {
      if (this.modeManager.isOnlineMode()) {
        return await this.onlineService.createSale(saleData as OnlineSaleInput);
      } else {
        return await this.offlineService.createSale(saleData as OfflineSaleInput);
      }
    } catch (error) {
      console.error(`Error creating sale in ${currentMode} mode:`, error);
      
      // Fallback to offline mode if online fails
      if (this.modeManager.isOnlineMode()) {
        console.log('🔄 Falling back to offline mode for sale creation');
        return await this.offlineService.createSale(saleData as OfflineSaleInput);
      }
      
      throw error;
    }
  }

  async getTransactions(storeId: string, startDate?: Date, endDate?: Date): Promise<Database['public']['Tables']['transactions']['Row'][]> {
    const currentMode = this.modeManager.getCurrentMode();
    console.log(`🔄 Getting transactions in ${currentMode} mode`);

    try {
      if (this.modeManager.isOnlineMode()) {
        return await this.onlineService.getTransactions(storeId, startDate, endDate);
      } else {
        return await this.offlineService.getTransactions(storeId, startDate, endDate);
      }
    } catch (error) {
      console.error(`Error getting transactions in ${currentMode} mode:`, error);
      
      // Fallback to offline mode if online fails
      if (this.modeManager.isOnlineMode()) {
        console.log('🔄 Falling back to offline mode for transactions');
        return await this.offlineService.getTransactions(storeId, startDate, endDate);
      }
      
      throw error;
    }
  }

  // eTIMS operations
  async submitToETIMS(invoiceData: any): Promise<any> {
    const currentMode = this.modeManager.getCurrentMode();
    console.log(`🔄 Submitting to eTIMS in ${currentMode} mode`);

    try {
      if (this.modeManager.isOnlineMode()) {
        return await this.onlineService.submitToETIMS(invoiceData);
      } else {
        return await this.offlineService.submitToETIMS(invoiceData);
      }
    } catch (error) {
      console.error(`Error submitting to eTIMS in ${currentMode} mode:`, error);
      
      // Fallback to offline mode if online fails
      if (this.modeManager.isOnlineMode()) {
        console.log('🔄 Falling back to offline mode for eTIMS submission');
        return await this.offlineService.submitToETIMS(invoiceData);
      }
      
      throw error;
    }
  }

  // Reports
  async getSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const currentMode = this.modeManager.getCurrentMode();
    console.log(`🔄 Getting sales report in ${currentMode} mode`);

    try {
      if (this.modeManager.isOnlineMode()) {
        // For online mode, we'll use the offline report for now
        // In the future, this could be a separate online report service
        return await this.offlineService.getSalesReport(storeId, startDate, endDate);
      } else {
        return await this.offlineService.getSalesReport(storeId, startDate, endDate);
      }
    } catch (error) {
      console.error(`Error getting sales report in ${currentMode} mode:`, error);
      throw error;
    }
  }

  async getAllSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const currentMode = this.modeManager.getCurrentMode();
    console.log(`🔄 Getting all sales report in ${currentMode} mode`);

    try {
      if (this.modeManager.isOnlineMode()) {
        // For online mode, we'll use the offline report for now
        return await this.offlineService.getAllSalesReport(storeId, startDate, endDate);
      } else {
        return await this.offlineService.getAllSalesReport(storeId, startDate, endDate);
      }
    } catch (error) {
      console.error(`Error getting all sales report in ${currentMode} mode:`, error);
      throw error;
    }
  }

  // Sync operations (offline mode only)
  async syncPendingData(): Promise<void> {
    if (this.modeManager.isOnlineMode()) {
      console.log('🔄 Sync not needed in online mode');
      return;
    }

    console.log('🔄 Syncing pending data');
    try {
      await this.offlineService.syncPendingData();
    } catch (error) {
      console.error('Error syncing pending data:', error);
      throw error;
    }
  }

  async getPendingSyncCount(): Promise<number> {
    if (this.modeManager.isOnlineMode()) {
      return 0;
    }

    return await this.offlineService.getPendingSyncCount();
  }

  // Real-time subscriptions (online mode only)
  subscribeToProducts(storeId: string, callback: (payload: any) => void) {
    if (!this.modeManager.isOnlineMode()) {
      console.log('🔄 Real-time subscriptions not available in offline mode');
      return null;
    }

    return this.onlineService.subscribeToProducts(storeId, callback);
  }

  subscribeToTransactions(storeId: string, callback: (payload: any) => void) {
    if (!this.modeManager.isOnlineMode()) {
      console.log('🔄 Real-time subscriptions not available in offline mode');
      return null;
    }

    return this.onlineService.subscribeToTransactions(storeId, callback);
  }

  // Utility methods
  async checkConnection(): Promise<boolean> {
    if (this.modeManager.isOnlineMode()) {
      return await this.onlineService.checkConnection();
    } else {
      return await this.offlineService.checkHealth();
    }
  }

  getCurrentMode(): 'offline' | 'online' {
    return this.modeManager.getCurrentMode();
  }

  isOnlineMode(): boolean {
    return this.modeManager.isOnlineMode();
  }

  isOfflineMode(): boolean {
    return this.modeManager.isOfflineMode();
  }

  // Mode management
  getModeManager(): ModeManager {
    return this.modeManager;
  }

  // Offline-specific utilities
  async clearOfflineData(): Promise<void> {
    return await this.offlineService.clearOfflineData();
  }

  async getOfflineDataSize(): Promise<number> {
    return await this.offlineService.getOfflineDataSize();
  }
}

// Create a singleton instance (will be initialized with ModeManager)
let unifiedServiceInstance: UnifiedService | null = null;

export function getUnifiedService(modeManager?: ModeManager): UnifiedService {
  if (!unifiedServiceInstance) {
    if (!modeManager) {
      throw new Error('ModeManager is required to initialize UnifiedService');
    }
    unifiedServiceInstance = new UnifiedService(modeManager);
  }
  return unifiedServiceInstance;
}

export function destroyUnifiedService() {
  unifiedServiceInstance = null;
} 