import { createClient } from '@/lib/supabase-clients/pages';
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

export class OnlineService {
  private supabase = createClient();

  // Product operations
  async getProducts(storeId: string): Promise<Database['public']['Tables']['products']['Row'][]> {
    try {
      console.log('🔄 OnlineService.getProducts: Fetching products for store:', storeId);
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .order('name');

      if (error) throw error;
      const products = data || [];
      console.log('✅ OnlineService.getProducts: Received products:', products.length, 'products');
      console.log('📊 OnlineService.getProducts: Product quantities:', 
        products.map(p => ({ id: p.id, name: p.name, quantity: p.quantity }))
      );
      return products;
    } catch (error) {
      console.error('❌ OnlineService.getProducts: Error fetching products:', error);
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
      console.log('🔄 OnlineService: Creating sale with RPC:', {
        store_id: saleData.store_id,
        product_count: saleData.products.length,
        total_amount: saleData.total_amount,
        vat_total: saleData.vat_total
      });

      // Use the create_sale RPC function which handles multi-product sales
      const { data: transactionId, error } = await this.supabase
        .rpc('create_sale', {
          p_store_id: saleData.store_id,
          p_products: saleData.products.map(p => ({
            id: p.id,
            quantity: p.quantity,
            displayPrice: p.unit_price,
            vat_amount: p.vat_amount
          })),
          p_payment_method: saleData.payment_method,
          p_total_amount: saleData.total_amount,
          p_vat_total: saleData.vat_total,
          p_is_sync: false,
          p_timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('❌ OnlineService: create_sale RPC error:', error);
        throw error;
      }

      console.log('✅ OnlineService: Sale created successfully:', {
        transaction_id: transactionId,
        store_id: saleData.store_id
      });

      // Return a mock transaction object that matches the expected structure
      // The actual transaction data is stored in the database via the RPC
      return {
        id: transactionId || crypto.randomUUID(),
        store_id: saleData.store_id,
        product_id: null, // Multi-product sale, no single product_id
        quantity: saleData.products.reduce((sum, p) => sum + p.quantity, 0),
        total: saleData.total_amount,
        vat_amount: saleData.vat_total,
        payment_method: saleData.payment_method,
        timestamp: new Date().toISOString(),
        synced: true
      } as Database['public']['Tables']['transactions']['Row'];
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
        .order('timestamp', { ascending: false });

      if (startDate && endDate) {
        query = query
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString());
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
  async submitToETIMS(invoiceData: Record<string, unknown>): Promise<Record<string, unknown>> {
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

  async getPendingETIMSSubmissions(storeId: string): Promise<Record<string, unknown>[]> {
    try {
      const { data, error } = await this.supabase
        .from('etims_submissions')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pending ETIMS submissions:', error);
      throw error;
    }
  }

  async getInputVatSubmissions(storeId: string, startDate: Date, endDate: Date): Promise<Record<string, unknown>[]> {
    try {
      console.log('🔍 OnlineService: Fetching input VAT from purchases:', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const { data, error } = await this.supabase
        .from('purchases')
        .select(`
          *,
          purchase_items (
            *,
            products (
              name,
              sku,
              category,
              cost_price,
              vat_status
            )
          )
        `)
        .eq('store_id', storeId)
        .gt('input_vat_amount', 0)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching input VAT from purchases:', error);
        return [];
      }

      console.log('🔍 OnlineService: Input VAT purchases found:', {
        count: data?.length || 0,
        purchases: data?.map(p => ({
          id: p.id,
          invoice_number: p.invoice_number,
          date: p.date,
          input_vat_amount: p.input_vat_amount,
          total_amount: p.total_amount
        })) || []
      });

      return data || [];
    } catch (error) {
      console.error('Error fetching input VAT from purchases:', error);
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
            await this.supabase
              .from('etims_submissions')
              .update({ status: 'synced' })
              .eq('id', submission.id);
          }
        } catch (error) {
          console.error('Error syncing ETIMS submission:', error);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error in ETIMS sync:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Real-time subscriptions
  subscribeToProducts(storeId: string, callback: (payload: Record<string, unknown>) => void) {
    console.log('🔄 OnlineService: Setting up product subscription for store:', storeId);
    
    try {
      const channel = this.supabase
        .channel(`products-${storeId}-${Date.now()}`) // Unique channel name
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${storeId}`
        }, (payload) => {
          console.log('🔄 OnlineService: Product change received:', payload);
          try {
            callback(payload);
          } catch (error) {
            console.error('🔄 OnlineService: Error in product subscription callback:', error);
          }
        })
        .subscribe((status) => {
          console.log('🔄 OnlineService: Product subscription status:', status);
        });
      
      return channel;
    } catch (error) {
      console.error('🔄 OnlineService: Error setting up product subscription:', error);
      return null;
    }
  }

  subscribeToTransactions(storeId: string, callback: (payload: Record<string, unknown>) => void) {
    console.log('🔄 OnlineService: Setting up transaction subscription for store:', storeId);
    
    try {
      const channel = this.supabase
        .channel(`transactions-${storeId}-${Date.now()}`) // Unique channel name
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `store_id=eq.${storeId}`
        }, (payload) => {
          console.log('🔄 OnlineService: Transaction change received:', payload);
          try {
            callback(payload);
          } catch (error) {
            console.error('🔄 OnlineService: Error in transaction subscription callback:', error);
          }
        })
        .subscribe((status) => {
          console.log('🔄 OnlineService: Transaction subscription status:', status);
        });
      
      return channel;
    } catch (error) {
      console.error('🔄 OnlineService: Error setting up transaction subscription:', error);
      return null;
    }
  }

  // Utility methods
  private async getCurrentUserId(): Promise<string> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error || !user) {
        throw new Error('User not authenticated');
      }
      return user.id;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      throw new Error('Failed to get current user ID');
    }
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

  async getAppSettings(): Promise<AppSettings> {
    try {
      const { data, error } = await this.supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'global')
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching app settings:', error);
      throw error;
    }
  }

  async updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('app_settings')
        .update(settings)
        .eq('id', 'global');
      if (error) throw error;
    } catch (error) {
      console.error('Error updating app settings:', error);
      throw error;
    }
  }

  // Purchase operations
  async getPurchases(storeId: string, startDate?: Date, endDate?: Date): Promise<Array<Database['public']['Tables']['purchases']['Row'] & { items: Database['public']['Tables']['purchase_items']['Row'][]; supplier_name?: string }>> {
    try {
      let query = this.supabase
        .from('purchases')
        .select(`
          *,
          purchase_items (*),
          suppliers (name)
        `)
        .eq('store_id', storeId)
        .order('date', { ascending: false });

      if (startDate && endDate) {
        query = query
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform the data to match the expected format
      const purchasesWithItems = (data || []).map(purchase => ({
        ...purchase,
        items: purchase.purchase_items || [],
        supplier_name: purchase.suppliers?.name || purchase.supplier_name || ''
      }));

      return purchasesWithItems;
    } catch (error) {
      console.error('Error fetching purchases:', error);
      throw error;
    }
  }

  async createPurchase(purchaseData: PurchaseInput): Promise<Database['public']['Tables']['purchases']['Row'] & { items: Database['public']['Tables']['purchase_items']['Row'][] }> {
    try {
      console.log('🔄 OnlineService: Creating purchase:', {
        store_id: purchaseData.store_id,
        supplier_name: purchaseData.supplier_name,
        total_amount: purchaseData.total_amount,
        items_count: purchaseData.items.length
      });

      // First, handle supplier creation/finding
      let supplierId = purchaseData.supplier_id || null;
      
      if (purchaseData.supplier_name && !supplierId) {
        console.log('🔄 OnlineService: Looking for existing supplier:', purchaseData.supplier_name);
        
        // Try to find existing supplier by VAT number first, then by name
        let existingSupplier = null;
        
        if (purchaseData.supplier_vat_no) {
          const cleanVatNo = purchaseData.supplier_vat_no.trim();
          console.log('🔄 OnlineService: Searching for supplier by VAT:', cleanVatNo);
          
          const { data: suppliersByVat, error: vatError } = await this.supabase
            .from('suppliers')
            .select('id, name')
            .eq('vat_no', cleanVatNo)
            .limit(1);
          
          if (vatError) {
            console.error('Error searching supplier by VAT:', vatError);
          } else if (suppliersByVat && suppliersByVat.length > 0) {
            existingSupplier = suppliersByVat[0];
            console.log('✅ OnlineService: Found supplier by VAT:', existingSupplier.name);
          } else {
            console.log('ℹ️ OnlineService: No supplier found by VAT:', cleanVatNo);
          }
        }
        
        if (!existingSupplier && purchaseData.supplier_name) {
          // Clean the supplier name for better matching
          const cleanSupplierName = purchaseData.supplier_name.trim().toLowerCase();
          console.log('🔄 OnlineService: Searching for supplier by name:', cleanSupplierName);
          
          // Use case-insensitive search with ilike for better matching
          const { data: suppliersByName, error: nameError } = await this.supabase
            .from('suppliers')
            .select('id, name')
            .ilike('name', cleanSupplierName)
            .limit(1);
          
          if (nameError) {
            console.error('Error searching supplier by name:', nameError);
          } else if (suppliersByName && suppliersByName.length > 0) {
            existingSupplier = suppliersByName[0];
            console.log('✅ OnlineService: Found supplier by name:', existingSupplier.name);
          } else {
            console.log('ℹ️ OnlineService: No supplier found by name:', cleanSupplierName);
          }
        }
        
        if (!existingSupplier) {
          console.log('🔄 OnlineService: Creating new supplier:', purchaseData.supplier_name);
          
          // Double-check to prevent duplicates - search for exact name match
          const { data: exactMatches, error: exactError } = await this.supabase
            .from('suppliers')
            .select('id, name')
            .eq('name', purchaseData.supplier_name.trim())
            .limit(1);
          
          if (exactError) {
            console.error('Error checking for exact supplier match:', exactError);
          } else if (exactMatches && exactMatches.length > 0) {
            // Found exact match, use existing supplier
            existingSupplier = exactMatches[0];
            console.log('✅ OnlineService: Found exact supplier match:', existingSupplier.name);
          } else {
            // No exact match found, create new supplier
            const { data: newSupplier, error: supplierError } = await this.supabase
              .from('suppliers')
              .insert([{
                name: purchaseData.supplier_name.trim(),
                vat_no: purchaseData.supplier_vat_no || null,
                contact_info: null
              }])
              .select('id, name')
              .single();
            
            if (supplierError) {
              console.error('❌ OnlineService: Error creating supplier:', supplierError);
              // Instead of throwing an error, set supplier_id to null and continue
              console.warn('⚠️ OnlineService: Continuing without supplier_id due to creation failure');
              supplierId = null;
            } else {
              supplierId = newSupplier.id;
              console.log('✅ OnlineService: Created new supplier:', newSupplier.name, 'with ID:', newSupplier.id);
            }
          }
        } else {
          supplierId = existingSupplier.id;
          console.log('✅ OnlineService: Using existing supplier:', existingSupplier.name, 'with ID:', existingSupplier.id);
        }
      }

      console.log('🔄 OnlineService: Creating purchase with supplier_id:', supplierId);

      // Create the purchase with supplier_id instead of supplier_name
      const { data: purchase, error: purchaseError } = await this.supabase
        .from('purchases')
        .insert([{
          store_id: purchaseData.store_id,
          supplier_id: supplierId,
          invoice_number: purchaseData.invoice_number,
          supplier_vat_no: purchaseData.supplier_vat_no,
          is_vat_included: purchaseData.is_vat_included,
          input_vat_amount: purchaseData.input_vat_amount,
          total_amount: purchaseData.total_amount,
          date: purchaseData.date,
          notes: purchaseData.notes || '',
        }])
        .select()
        .single();

      if (purchaseError) {
        console.error('❌ OnlineService: Error creating purchase:', purchaseError);
        throw purchaseError;
      }

      console.log('✅ OnlineService: Purchase created successfully:', purchase.id);

      // Then, create the purchase items
      const purchaseItems = purchaseData.items.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        vat_amount: item.vat_amount,
      }));

      const { data: items, error: itemsError } = await this.supabase
        .from('purchase_items')
        .insert(purchaseItems)
        .select();

      if (itemsError) {
        console.error('❌ OnlineService: Error creating purchase items:', itemsError);
        throw itemsError;
      }

      console.log('✅ OnlineService: Purchase items created:', items?.length || 0);

      // Update product stock for each item
      for (const item of purchaseData.items) {
        // Get current product to calculate new quantity
        const { data: currentProduct, error: getError } = await this.supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .eq('store_id', purchaseData.store_id)
          .single();

        if (getError) {
          console.error('❌ OnlineService: Error getting current product:', getError);
          continue;
        }

        const newQuantity = (currentProduct?.quantity || 0) + item.quantity;
        
        const { error: stockError } = await this.supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', item.product_id)
          .eq('store_id', purchaseData.store_id);

        if (stockError) {
          console.error('❌ OnlineService: Error updating product stock:', stockError);
          // Continue with other items even if one fails
        } else {
          console.log('✅ OnlineService: Updated product stock for product:', item.product_id, 'new quantity:', newQuantity);
        }
      }

      console.log('✅ OnlineService: Purchase created successfully:', {
        purchase_id: purchase.id,
        items_count: items?.length || 0
      });

      return {
        ...purchase,
        items: items || []
      };
    } catch (error) {
      console.error('❌ OnlineService: Error creating purchase:', error);
      throw error;
    }
  }

  // Add the missing report methods for online mode
  async getSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<Array<{
    id: string;
    product_id: string;
    quantity: number;
    total: number;
    vat_amount: number;
    payment_method: string;
    timestamp: string;
    sale_mode: 'retail' | 'wholesale';
    products: {
      name: string;
      sku: string | null;
      selling_price: number;
      vat_status: boolean;
      category: string | null;
      cost_price: number;
    };
  }>> {
    try {
      console.log('📊 OnlineService: getSalesReport called with:', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Query transactions with product details
      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select(`
          *,
          products (
            name,
            sku,
            selling_price,
            vat_status,
            category,
            cost_price
          )
        `)
        .eq('store_id', storeId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Transform the data to match the expected format
      const transformedTransactions = (transactions || []).map(transaction => ({
        id: transaction.id,
        product_id: transaction.product_id,
        quantity: transaction.quantity,
        total: transaction.total,
        vat_amount: transaction.vat_amount * transaction.quantity, // Fix: Multiply by quantity to get total VAT
        payment_method: transaction.payment_method,
        timestamp: transaction.timestamp,
        sale_mode: 'retail' as const, // Default to retail for online mode
        products: {
          name: transaction.products?.name || 'Unknown',
          sku: transaction.products?.sku || null,
          selling_price: transaction.products?.selling_price || 0,
          vat_status: transaction.products?.vat_status || false,
          category: transaction.products?.category || null,
          cost_price: transaction.products?.cost_price || 0
        }
      }));

      // Filter out vatable products with zero VAT amount (same logic as offline)
      const filteredTransactions = transformedTransactions.filter(t => {
        const isVatable = t.products?.vat_status === true;
        if (isVatable) {
          return (t.vat_amount || 0) > 0;
        }
        // For zero-rated/exempted, always include
        return true;
      });

      console.log('📊 OnlineService: Found transactions:', {
        count: filteredTransactions.length,
        transactions: filteredTransactions.map(t => ({
          id: t.id,
          timestamp: t.timestamp,
          total: t.total,
          product_name: t.products.name,
          sale_mode: t.sale_mode
        }))
      });

      return filteredTransactions;
    } catch (error) {
      console.error('Error getting online sales report:', error);
      throw error;
    }
  }

  async getAllSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<Array<{
    id: string;
    product_id: string;
    quantity: number;
    total: number;
    vat_amount: number;
    payment_method: string;
    timestamp: string;
    sale_mode: 'retail' | 'wholesale';
    products: {
      name: string;
      sku: string | null;
      selling_price: number;
      vat_status: boolean;
      category: string | null;
      cost_price: number;
    };
  }>> {
    try {
      console.log('📊 OnlineService: getAllSalesReport called with:', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Query transactions with product details (same as getSalesReport but without VAT filtering)
      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select(`
          *,
          products (
            name,
            sku,
            selling_price,
            vat_status,
            category,
            cost_price
          )
        `)
        .eq('store_id', storeId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Transform the data to match the expected format
      const transformedTransactions = (transactions || []).map(transaction => ({
        id: transaction.id,
        product_id: transaction.product_id,
        quantity: transaction.quantity,
        total: transaction.total,
        vat_amount: transaction.vat_amount,
        payment_method: transaction.payment_method,
        timestamp: transaction.timestamp,
        sale_mode: 'retail' as const, // Default to retail for online mode
        products: {
          name: transaction.products?.name || 'Unknown',
          sku: transaction.products?.sku || null,
          selling_price: transaction.products?.selling_price || 0,
          vat_status: transaction.products?.vat_status || false,
          category: transaction.products?.category || null,
          cost_price: transaction.products?.cost_price || 0
        }
      }));

      console.log('📊 OnlineService: Found ALL transactions:', {
        count: transformedTransactions.length,
        transactions: transformedTransactions.map(t => ({
          id: t.id,
          timestamp: t.timestamp,
          total: t.total,
          product_name: t.products.name,
          sale_mode: t.sale_mode
        }))
      });

      return transformedTransactions;
    } catch (error) {
      console.error('Error getting online all sales report:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const onlineService = new OnlineService(); 