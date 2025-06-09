import { useEffect, useState } from 'react';
import { syncService } from '@/lib/sync';
import { Database } from '@/types/supabase';
import { db, processSyncQueue, saveOfflineProduct, updateOfflineStockQuantity } from '@/lib/db/index';
import { useAuth } from '@/components/providers/AuthProvider';
import { calculateVAT } from '@/lib/vat/utils';

// Define the structure expected by the createSale RPC
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
}

interface ReportData {
  data: Array<{
    id: string;
    product_id: string;
    quantity: number;
    total: number;
    vat_amount: number;
    payment_method: string;
    timestamp: string;
    products: {
      name: string;
      sku: string | null;
      selling_price: number | null;
      vat_status: boolean | null;
      category: string | null;
    } | null;
  }>;
}

interface OfflineTransaction {
  id: string;
  store_id: string;
  payment_method: string;
  total_amount: number;
  vat_total: number;
  timestamp: string;
  synced: boolean;
}

interface OfflineSaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price: number;
  vat_amount: number;
  sale_mode: 'retail' | 'wholesale';
  timestamp: string;
}

interface InventoryReportData {
  data: Array<{
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    quantity: number;
    low_stock: boolean;
    retail_price: number | null;
    wholesale_price: number | null;
    wholesale_threshold: number | null;
  }>;
}

export function useSync(store_id: string) {
  const { isOnline } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      // Trigger sync when coming back online
      sync();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [store_id]);

  const sync = async () => {
    if (!isOnline) return;
    
    setIsSyncing(true);
    try {
      // Get offline data
      const { pendingTransactions } = await processSyncQueue();
      
      // Process offline sales using createSale RPC
      for (const transaction of pendingTransactions) {
        try {
          // Get sale items for this transaction
          const saleItems = await db.sale_items
            .where('sale_id')
            .equals(transaction.id)
            .toArray();

          // Prepare products array for createSale RPC
          const products = saleItems.map(item => ({
            id: item.product_id,
            quantity: item.quantity,
            displayPrice: item.price,
            vat_amount: item.vat_amount
          }));

          // Call createSale RPC through syncService
          await syncService.saveSale({
            store_id: transaction.store_id,
            products,
            payment_method: transaction.payment_method as 'cash' | 'mpesa',
            total_amount: transaction.total_amount,
            vat_total: transaction.vat_total
          });

          // Mark transaction as synced
          await db.transactions.update(transaction.id, { synced: true });
        } catch (error) {
          console.error('Error syncing sale:', error);
          // Continue with other sales even if one fails
        }
      }

      // Get latest data after sync
      await syncService.initialSync(store_id);
      setLastSynced(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const generateReports = async (startDate: Date, endDate: Date): Promise<ReportData> => {
    try {
      if (isOnline) {
        // Get online reports with product details
        const sales = await syncService.getSalesWithProducts(store_id, startDate, endDate);

        return {
          data: sales.map(sale => {
            const vatCalculation = calculateVAT(sale.total, sale.products?.vat_status ?? true);
            return {
              id: sale.id,
              product_id: sale.product_id || '',
              quantity: sale.quantity,
              total: sale.total,
              vat_amount: vatCalculation.vatAmount,
              payment_method: sale.payment_method || 'cash',
              timestamp: sale.timestamp || new Date().toISOString(),
              products: sale.products ? {
                ...sale.products,
                selling_price: sale.products.selling_price || 0,
                vat_status: sale.products.vat_status ?? true
              } : null
            };
          })
        };
      } else {
        // Direct fetch from IndexedDB for offline mode
        const transactions = await db.transactions
          .where('store_id')
          .equals(store_id)
          .and((transaction: OfflineTransaction) => {
            if (!transaction.timestamp) return false;
            const transactionDate = new Date(transaction.timestamp);
            const startOfDay = new Date(startDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            return transactionDate >= startOfDay && transactionDate <= endOfDay;
          })
          .toArray() as OfflineTransaction[];

        if (transactions.length === 0) {
          return { data: [] };
        }

        // Get all sale items for these transactions
        const saleItems = await db.sale_items
          .where('sale_id')
          .anyOf(transactions.map(t => t.id))
          .toArray() as OfflineSaleItem[];

        if (saleItems.length === 0) {
          return { data: [] };
        }

        // Get all products involved in these sales
        const productIds = [...new Set(saleItems.map(item => item.product_id))];
        const products = await db.products
          .where('id')
          .anyOf(productIds)
          .toArray();

        // Create a map of products for quick lookup
        const productsMap = products.reduce<Record<string, Database['public']['Tables']['products']['Row']>>((acc, product) => {
          acc[product.id] = product;
          return acc;
        }, {});

        // Group sale items by sale_id
        const saleItemsBySaleId = saleItems.reduce<Record<string, OfflineSaleItem[]>>((acc, item) => {
          if (!acc[item.sale_id]) {
            acc[item.sale_id] = [];
          }
          acc[item.sale_id].push(item);
          return acc;
        }, {});

        // Transform offline sales to match the expected format
        const transformedSales = transactions.map(transaction => {
          const items = saleItemsBySaleId[transaction.id] || [];
          
          return items.map(item => {
            const product = productsMap[item.product_id];
            const unitPrice = item.price;
            const totalAmount = item.price * item.quantity;
            const vatCalculation = calculateVAT(totalAmount, product?.vat_status ?? true);
            
            return {
              id: `${transaction.id}-${item.product_id}`,
              product_id: item.product_id,
              quantity: item.quantity,
              total: totalAmount,
              vat_amount: vatCalculation.vatAmount,
              payment_method: transaction.payment_method,
              timestamp: transaction.timestamp,
              products: product ? {
                name: product.name,
                sku: product.sku,
                selling_price: unitPrice,
                vat_status: product.vat_status ?? true,
                category: product.category
              } : {
                name: 'Unknown Product',
                sku: null,
                selling_price: unitPrice,
                vat_status: true,
                category: null
              }
            };
          });
        }).flat();

        return {
          data: transformedSales
        };
      }
    } catch (error) {
      console.error('Error generating reports:', error);
      throw error;
    }
  };

  const saveSale = async (sale: SaleInput) => {
    try {
      const result = await syncService.saveSale(sale);
      if (isOnline) {
        setLastSynced(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error saving sale:', error);
      throw error;
    }
  };

  const updateStock = async (product_id: string, quantity_change: number) => {
    try {
      const result = await syncService.updateStock(product_id, quantity_change);
      if (isOnline) {
        setLastSynced(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  };

  const submitToETIMS = async (invoice_number: string, data: Record<string, unknown>) => {
    try {
      const result = await syncService.submitToETIMS({
        store_id,
        invoice_number,
        data
      });
      if (isOnline) {
        setLastSynced(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error submitting to eTIMS:', error);
      throw error;
    }
  };

  const getProducts = async () => {
    try {
      const products = await syncService.getProducts(store_id);
      return products.filter(product => product.store_id === store_id);
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  };

  const generateInventoryReport = async (): Promise<InventoryReportData> => {
    try {
      if (isOnline) {
        // Get online inventory report from Supabase
        const products = await syncService.getProducts(store_id);

        return {
          data: products.map((product: Database['public']['Tables']['products']['Row']) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            quantity: product.quantity,
            low_stock: product.quantity <= (product.wholesale_threshold || 0),
            retail_price: product.retail_price,
            wholesale_price: product.wholesale_price,
            wholesale_threshold: product.wholesale_threshold
          }))
        };
      } else {
        // Direct fetch from IndexedDB for offline mode
        const products = await db.products
          .where('store_id')
          .equals(store_id)
          .toArray();

        if (products.length === 0) {
          return { data: [] };
        }

        return {
          data: products.map((product: Database['public']['Tables']['products']['Row']) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            quantity: product.quantity,
            low_stock: product.quantity <= (product.wholesale_threshold || 0),
            retail_price: product.retail_price,
            wholesale_price: product.wholesale_price,
            wholesale_threshold: product.wholesale_threshold
          }))
        };
      }
    } catch (error) {
      console.error('Error generating inventory report:', error);
      throw error;
    }
  };

  const createProduct = async (product: Database['public']['Tables']['products']['Insert']) => {
    try {
      if (isOnline) {
        return await syncService.createProduct(product);
      } else {
        // Save product offline
        return await saveOfflineProduct(product);
      }
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  };

  const createProductsBatch = async (products: Database['public']['Tables']['products']['Insert'][]) => {
    try {
      if (isOnline) {
        return await syncService.createProductsBatch(products);
      } else {
        // Save products offline in batch
        const results = await Promise.all(products.map(product => saveOfflineProduct(product)));
        return results;
      }
    } catch (error) {
      console.error('Error creating products batch:', error);
      throw error;
    }
  };

  const addStockQuantity = async (productId: string, quantityToAdd: number) => {
    try {
      if (isOnline) {
        return await syncService.updateStock(productId, quantityToAdd);
      } else {
        // Update stock offline
        return await updateOfflineStockQuantity(productId, quantityToAdd);
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  };

  const updateStockBatch = async (updates: Array<{ productId: string; quantityChange: number }>) => {
    try {
      if (isOnline) {
        return await syncService.updateStockBatch(
          updates.map(update => ({
            product_id: update.productId,
            quantity_change: update.quantityChange
          }))
        );
      } else {
        // Update stock offline in batch
        const results = await Promise.all(
          updates.map(update => updateOfflineStockQuantity(update.productId, update.quantityChange))
        );
        return results;
      }
    } catch (error) {
      console.error('Error updating stock batch:', error);
      throw error;
    }
  };

  return {
    isOnline,
    isSyncing,
    lastSynced,
    saveSale,
    updateStock,
    submitToETIMS,
    getProducts,
    generateReports,
    generateInventoryReport,
    createProduct,
    createProductsBatch,
    addStockQuantity,
    updateStockBatch
  };
} 