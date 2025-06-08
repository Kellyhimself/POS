import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { db } from '@/lib/db';
import { syncService } from '@/lib/sync';
import type { Database } from '@/types/supabase';

type Product = Database['public']['Tables']['products']['Row'];

export interface SyncStatus {
  isSyncing: boolean;
  currentItem: number;
  totalItems: number;
  lastSyncTime: Date | null;
  error: string | null;
}

export function useGlobalSaleSync() {
  const { user, isOnline } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    currentItem: 0,
    totalItems: 0,
    lastSyncTime: null,
    error: null
  });

  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    const syncSales = async () => {
      if (!user?.user_metadata?.store_id || !isOnline) return;

      try {
        setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));
        
        // Get all pending transactions ordered by creation time
        const pendingTransactions = await db.transactions
          .filter(transaction => transaction.synced === false)
          .toArray()
          .then(transactions => 
            transactions.sort((a, b) => 
              new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
            )
          );

        setSyncStatus(prev => ({ ...prev, totalItems: pendingTransactions.length }));
        
        for (const [index, transaction] of pendingTransactions.entries()) {
          try {
            setSyncStatus(prev => ({ ...prev, currentItem: index + 1 }));
            
            // Get sale items for this transaction
            const saleItems = await db.sale_items
              .where('sale_id')
              .equals(transaction.id)
              .toArray()
              .then(items => 
                items.sort((a, b) => 
                  new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
                )
              );

            const productIds = [...new Set(saleItems.map(item => item.product_id))];
            const products = await db.products
              .where('id')
              .anyOf(productIds)
              .toArray();

            // Check if any products need to be synced first
            const unsyncedProducts = products.filter(p => !p.synced);
            if (unsyncedProducts.length > 0) {
              console.log('🔄 Found unsynced products, syncing them first:', unsyncedProducts);
              try {
                // First check which products exist in Supabase
                const { data: existingProducts, error: fetchError } = await syncService.supabase
                  .from('products')
                  .select('id')
                  .in('id', unsyncedProducts.map(p => p.id));

                if (fetchError) throw fetchError;

                const existingProductIds = new Set(existingProducts?.map(p => p.id) || []);
                
                // Split products into new and existing
                const newProducts = unsyncedProducts.filter(p => !existingProductIds.has(p.id));
                const existingProductsToUpdate = unsyncedProducts.filter(p => existingProductIds.has(p.id));

                // Handle new products
                if (newProducts.length > 0) {
                  console.log('📦 Creating new products:', newProducts);
                  await syncService.createProductsBatch(newProducts);
                }

                // Handle existing products
                if (existingProductsToUpdate.length > 0) {
                  console.log('📦 Updating existing products:', existingProductsToUpdate);
                  const updatePromises = existingProductsToUpdate.map(product => 
                    syncService.updateStock(product.id, product.quantity)
                  );
                  await Promise.all(updatePromises);
                }
                
                // Update local products as synced
                await Promise.all(
                  unsyncedProducts.map(product => 
                    db.products.update(product.id, { synced: true })
                  )
                );
              } catch (error) {
                console.error('Error syncing products:', error);
                // Continue with sale sync even if product sync fails
              }
            }

            const productsMap = products.reduce<Record<string, Product>>((acc, product) => {
              acc[product.id] = product;
              return acc;
            }, {});

            const productsForSync = saleItems.map(item => ({
              id: item.product_id,
              quantity: item.quantity,
              displayPrice: item.price,
              vat_amount: item.vat_amount
            }));

            await syncService.saveSale({
              store_id: transaction.store_id,
              products: productsForSync,
              payment_method: transaction.payment_method as 'cash' | 'mpesa',
              total_amount: transaction.total_amount,
              vat_total: transaction.vat_total,
              is_sync: true
            });

            await db.transactions.update(transaction.id, { 
              synced: true,
              report_data: {
                product_id: saleItems[0]?.product_id || '',
                quantity: saleItems[0]?.quantity || 0,
                products: saleItems[0] ? {
                  name: productsMap[saleItems[0].product_id]?.name || 'Unknown Product',
                  sku: productsMap[saleItems[0].product_id]?.sku || null,
                  selling_price: productsMap[saleItems[0].product_id]?.selling_price || saleItems[0].price,
                  vat_status: productsMap[saleItems[0].product_id]?.vat_status || true,
                  category: productsMap[saleItems[0].product_id]?.category || null
                } : null
              }
            });
          } catch (error) {
            console.error('Error syncing transaction:', error);
            setSyncStatus(prev => ({ 
              ...prev, 
              error: `Failed to sync transaction ${index + 1}`
            }));
          }
        }

        setSyncStatus(prev => ({ 
          ...prev, 
          isSyncing: false, 
          lastSyncTime: new Date(),
          currentItem: 0,
          totalItems: 0
        }));
      } catch (err) {
        console.error('Error in sync process:', err);
        setSyncStatus(prev => ({ 
          ...prev, 
          isSyncing: false, 
          error: 'Failed to process sync queue'
        }));
      }
    };

    if (isOnline && user?.user_metadata?.store_id) {
      syncSales();
    }

    if (isOnline) {
      syncInterval = setInterval(syncSales, 5 * 60 * 1000);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isOnline, user?.user_metadata?.store_id]);

  return syncStatus;
} 