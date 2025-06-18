import { useEffect, useState } from 'react';
import { syncService } from '@/lib/sync';
import { Database } from '@/types/supabase';
import { db, processSyncQueue, saveOfflineProduct, getETIMSReport, updateOfflineStockQuantity, getSalesReport } from '@/lib/db/index';
import { useAuth } from '@/components/providers/AuthProvider';
import { calculateVAT } from '@/lib/vat/utils';
import { submitEtimsInvoice } from '@/lib/etims/utils';


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
      cost_price: number;
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
  created_at: string;
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
  created_at: string;
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
      // No need to trigger sync here as useGlobalSaleSync will handle it
      setLastSynced(new Date());
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [store_id]);

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

  const submitToETIMS = async (invoice_number: string, data: EtimsInvoice) => {
    try {
      const { data: result, error } = await submitEtimsInvoice(data);
      
      if (error) throw error;
      
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

  const generateReports = async (startDate: Date, endDate: Date) => {
    try {
      return await syncService.generateReports(store_id, startDate, endDate);
    } catch (error) {
      console.error('Error generating reports:', error);
      throw error;
    }
  };

  const generateInventoryReport = async () => {
    try {
      return await syncService.getStockReport(store_id);
    } catch (error) {
      console.error('Error generating inventory report:', error);
      throw error;
    }
  };

  const createProduct = async (product: Database['public']['Tables']['products']['Insert']) => {
    try {
      const result = await syncService.createProduct(product);
      if (isOnline) {
        setLastSynced(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  };

  const createProductsBatch = async (products: Database['public']['Tables']['products']['Insert'][]) => {
    try {
      const result = await syncService.createProductsBatch(products);
      if (isOnline) {
        setLastSynced(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error creating products batch:', error);
      throw error;
    }
  };

  const addStockQuantity = async (productId: string, quantityToAdd: number) => {
    try {
      const result = await syncService.updateStock(productId, quantityToAdd);
      if (isOnline) {
        setLastSynced(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error adding stock quantity:', error);
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

  const generateInputVatReport = async (startDate: Date, endDate: Date) => {
    try {
      console.log('🔍 generateInputVatReport() - Starting report generation', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const report = await getETIMSReport(store_id, startDate, endDate);
      
      console.log('📊 Raw eTIMS report data:', {
        inputVatCount: report.input_vat.length,
        outputVatCount: report.output_vat.length,
        totalCount: report.all.length
      });

      const transformedData = {
        data: report.input_vat.map(submission => {
          // Log the raw response data to understand its structure
          console.log('🔍 Raw submission response_data:', {
            id: submission.id,
            response_data: submission.response_data,
            response_data_type: typeof submission.response_data
          });

          // Parse response_data if it's a JSON string
          let parsedResponseData = submission.response_data;
          if (typeof submission.response_data === 'string') {
            try {
              parsedResponseData = JSON.parse(submission.response_data);
              console.log('🔄 Parsed response_data from JSON string:', parsedResponseData);
            } catch (parseError) {
              console.error('❌ Error parsing response_data JSON:', parseError);
              parsedResponseData = null;
            }
          }

          // Extract product information with better error handling
          let productName = 'Unknown';
          let unitPrice = null;
          
          if (parsedResponseData && parsedResponseData.items && Array.isArray(parsedResponseData.items) && parsedResponseData.items.length > 0) {
            const firstItem = parsedResponseData.items[0];
            productName = firstItem.description || firstItem.name || 'Unknown Product';
            unitPrice = firstItem.unit_price || firstItem.price || null;
            
            console.log('📦 Extracted product info:', {
              productName,
              unitPrice,
              item: firstItem
            });
          } else {
            console.warn('⚠️ No valid items found in response_data:', {
              id: submission.id,
              hasResponseData: !!parsedResponseData,
              hasItems: !!(parsedResponseData && parsedResponseData.items),
              itemsLength: parsedResponseData?.items?.length || 0
            });
          }

          const transformed = {
            id: submission.id,
            invoice_number: submission.invoice_number,
            total: parsedResponseData?.total_amount || 0,
            vat_amount: parsedResponseData?.vat_total || 0,
            timestamp: submission.submitted_at,
            submission_type: 'input_vat',
            products: {
              name: productName,
              sku: null,
              selling_price: unitPrice,
              vat_status: true,
              category: 'Stock Update', // Set a default category for input VAT
              cost_price: 0 // Assuming cost_price is not available in the response_data
            }
          };

          console.log('🔄 Transformed submission:', {
            original: {
              id: submission.id,
              invoice_number: submission.invoice_number,
              response_data: submission.response_data
            },
            transformed
          });

          return transformed;
        })
      };

      console.log('✅ Final transformed report:', {
        totalItems: transformedData.data.length,
        items: transformedData.data.map(item => ({
          id: item.id,
          name: item.products.name,
          total: item.total,
          vat_amount: item.vat_amount
        }))
      });

      return transformedData;
    } catch (error) {
      console.error('❌ Error generating input VAT report:', error);
      throw error;
    }
  };

  const generalReport = async (startDate: Date, endDate: Date) => {
    try {
      return await syncService.getAllSalesReport(store_id, startDate, endDate);
    } catch (error) {
      console.error('Error generating general report:', error);
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
    updateStockBatch,
    generateInputVatReport,
    generalReport,
  };
} 