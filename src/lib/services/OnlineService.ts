import { createClient } from '@/lib/supabase-clients/pages';
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

export class OnlineService {
  private supabase = createClient();

  // Product operations
  async getProducts(storeId: string): Promise<Database['public']['Tables']['products']['Row'][]> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async createProduct(productData: CreateProductInput): Promise<Database['public']['Tables']['products']['Row']> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(productId: string, updates: Partial<Database['public']['Tables']['products']['Update']>): Promise<Database['public']['Tables']['products']['Row']> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async updateStock(productId: string, quantityChange: number, version: number): Promise<Database['public']['Tables']['products']['Row']> {
    try {
      // Use optimistic locking function
      const { data, error } = await this.supabase.rpc('update_stock_safe', {
        p_product_id: productId,
        p_quantity_change: quantityChange,
        p_expected_version: version,
        p_user_id: await this.getCurrentUserId()
      });

      if (error) {
        if (error.message.includes('Product has been modified by another user')) {
          throw new Error('CONFLICT: Product has been modified by another user. Please refresh and try again.');
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  // Sale operations
  async createSale(saleData: SaleInput): Promise<Database['public']['Tables']['transactions']['Row']> {
    try {
      // Use the real-time sale creation function
      const { data: transactionId, error } = await this.supabase.rpc('create_sale_realtime', {
        p_store_id: saleData.store_id,
        p_user_id: saleData.user_id,
        p_products: saleData.products,
        p_payment_method: saleData.payment_method,
        p_total_amount: saleData.total_amount,
        p_vat_total: saleData.vat_total
      });

      if (error) throw error;

      // Fetch the created transaction
      const { data: transaction, error: fetchError } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (fetchError) throw fetchError;
      return transaction;
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  }

  async getTransactions(storeId: string, startDate?: Date, endDate?: Date): Promise<Database['public']['Tables']['transactions']['Row'][]> {
    try {
      let query = this.supabase
        .from('transactions')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (startDate && endDate) {
        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  // eTIMS operations
  async submitToETIMS(invoiceData: any): Promise<any> {
    try {
      // This would integrate with KRA's eTIMS API
      // For now, we'll simulate the submission
      const { data, error } = await this.supabase
        .from('etims_submissions')
        .insert([{
          store_id: invoiceData.store_id,
          invoice_number: invoiceData.invoice_number,
          data: invoiceData,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submission_type: 'invoice'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error submitting to eTIMS:', error);
      throw error;
    }
  }

  // Real-time subscriptions
  subscribeToProducts(storeId: string, callback: (payload: any) => void) {
    return this.supabase
      .channel('products')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `store_id=eq.${storeId}`
      }, callback)
      .subscribe();
  }

  subscribeToTransactions(storeId: string, callback: (payload: any) => void) {
    return this.supabase
      .channel('transactions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `store_id=eq.${storeId}`
      }, callback)
      .subscribe();
  }

  // Utility methods
  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user.id;
  }

  // Health check
  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('products')
        .select('id')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }
}

// Create a singleton instance
export const onlineService = new OnlineService(); 