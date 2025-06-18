import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { db } from '@/lib/db';
import { syncService } from '@/lib/sync';

export interface ProductSyncStatus {
  isSyncing: boolean;
  currentItem: number;
  totalItems: number;
  lastSyncTime: Date | null;
  error: string | null;
  syncType: 'products' | 'stock' | null;
}

// Create a module-level variable to store the sync status
let globalProductSyncStatus: ProductSyncStatus = {
  isSyncing: false,
  currentItem: 0,
  totalItems: 0,
  lastSyncTime: null,
  error: null,
  syncType: null
};

// Function to get the current sync status
export const getProductSyncStatus = () => globalProductSyncStatus;

// Function to manually trigger a sync
export const triggerProductSync = async () => {
  if (globalProductSyncStatus.isSyncing) {
    console.log('⏳ Product sync already in progress...');
    return;
  }
  
  console.log('🔄 Manually triggering product sync...');
  const syncProducts = async () => {
    // Skip sync if conditions aren't met
    if (!user?.user_metadata?.store_id || !isOnline) {
      console.log('⏸️ Product sync skipped - conditions not met:', {
        hasStoreId: !!user?.user_metadata?.store_id,
        isOnline
      });
      return;
    }

    console.log('🔄 Starting product sync cycle');

    try {
      const newStatus = { 
        ...globalProductSyncStatus, 
        isSyncing: true, 
        error: null,
        syncType: 'products' as const
      };
      globalProductSyncStatus = newStatus;

      // Get all products that need syncing (either unsynced or have quantity changes)
      const allProducts = await db.products.toArray();
      const pendingProducts = allProducts.filter(product => {
        if (product.synced === false) {
          console.log('🔄 Product needs sync:', {
            product_id: product.id,
            name: product.name,
            quantity: product.quantity
          });
          return true;
        }
        return false;
      }).sort((a, b) => 
        new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
      );

      console.log('📊 Products that need syncing:', 
        pendingProducts.map(p => ({
          id: p.id,
          name: p.name,
          quantity: p.quantity
        }))
      );

      const statusWithTotal = { ...newStatus, totalItems: pendingProducts.length };
      globalProductSyncStatus = statusWithTotal;

      if (pendingProducts.length > 0) {
        try {
          // Just use the current local quantities
          const productsToSync = pendingProducts.map(product => ({
            ...product,
            vat_status: typeof product.vat_status === 'string'
              ? product.vat_status === 'vatable'
              : !!product.vat_status,
            quantity: product.quantity // Use current local quantity
          }));

          console.log('🔄 Starting product sync process...');
          console.log('📊 Products to sync:', 
            productsToSync.map(p => ({
              id: p.id,
              name: p.name,
              quantity: p.quantity
            }))
          );

          // First, get existing products from Supabase
          const { data: existingProducts, error: fetchError } = await syncService.supabase
            .from('products')
            .select('id, quantity, sku')
            .in('id', productsToSync.map(p => p.id));

          if (fetchError) {
            throw fetchError;
          }

          // Also check for existing SKUs
          const { data: existingSkus, error: skuError } = await syncService.supabase
            .from('products')
            .select('id, sku')
            .in('sku', productsToSync.map(p => p.sku).filter(Boolean));

          if (skuError) {
            throw skuError;
          }

          console.log('📥 Existing products in Supabase:', 
            existingProducts?.map(p => ({
              id: p.id,
              quantity: p.quantity,
              sku: p.sku
            }))
          );

          const existingIds = new Set(existingProducts?.map(p => p.id) || []);
          const existingSkuMap = new Map(existingSkus?.map(p => [p.sku, p.id]) || []);
          
          // Split products into new and existing
          const newProducts = productsToSync.filter(p => !existingIds.has(p.id));
          const existingProductsToUpdate = productsToSync.filter(p => existingIds.has(p.id));

          // Check for SKU conflicts in new products
          const skuConflicts = newProducts.filter(p => p.sku && existingSkuMap.has(p.sku));
          if (skuConflicts.length > 0) {
            console.error('❌ SKU conflicts found:', 
              skuConflicts.map(p => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                existing_id: existingSkuMap.get(p.sku)
              }))
            );
            throw new Error(`SKU conflicts found for products: ${skuConflicts.map(p => p.name).join(', ')}`);
          }

          // Handle new products
          if (newProducts.length > 0) {
            console.log('📦 Creating new products:', 
              newProducts.map(p => ({
                id: p.id,
                name: p.name,
                quantity: p.quantity
              }))
            );
            await syncService.createProductsBatch(newProducts);
            console.log('✅ New products created successfully');
          }

          // Handle existing products
          if (existingProductsToUpdate.length > 0) {
            console.log('📦 Updating existing products:', 
              existingProductsToUpdate.map(p => ({
                id: p.id,
                name: p.name,
                current_quantity: p.quantity,
                server_quantity: existingProducts?.find(ep => ep.id === p.id)?.quantity
              }))
            );

            // Calculate the actual quantity change needed
            const stockUpdates = existingProductsToUpdate.map(p => {
              const serverProduct = existingProducts?.find(ep => ep.id === p.id);
              const serverQuantity = serverProduct?.quantity || 0;
              const quantityChange = p.quantity - serverQuantity; // This is the actual change needed

              return {
                product_id: p.id,
                quantity_change: quantityChange
              };
            });

            await syncService.updateStockBatch(stockUpdates);
            console.log('✅ Existing products updated successfully');
          }
          
          // Prepare products for upsert with all relevant fields
          const productsUpsert = productsToSync.map(product => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            store_id: product.store_id,
            quantity: product.quantity,
            unit_of_measure: product.unit_of_measure,
            units_per_pack: product.units_per_pack,
            retail_price: product.retail_price,
            wholesale_price: product.wholesale_price,
            wholesale_threshold: product.wholesale_threshold,
            cost_price: product.cost_price,
            vat_status: product.vat_status,
            parent_product_id: product.parent_product_id,
            selling_price: product.selling_price,
            input_vat_amount: product.input_vat_amount,
          }));

          // Upsert all products (new and updated) to Supabase
          if (productsUpsert.length > 0) {
            const { error: upsertError } = await syncService.supabase
              .from('products')
              .upsert(productsUpsert, { onConflict: 'id' });
            if (upsertError) throw upsertError;
          }

          // Mark all products as synced
          await Promise.all(
            pendingProducts.map(product => 
              db.products.update(product.id, { 
                synced: true
              })
            )
          );
          console.log('✅ Local products marked as synced');

          // Verify final state
          const { data: finalProducts } = await syncService.supabase
            .from('products')
            .select('id, quantity')
            .in('id', productsToSync.map(p => p.id));

            console.log('📊 Final product quantities in Supabase:', 
              finalProducts?.map(p => ({
                id: p.id,
                quantity: p.quantity
              }))
            );

          // Get local products after sync
          const localProducts = await db.products
            .where('id')
            .anyOf(productsToSync.map(p => p.id))
            .toArray();

          console.log('📊 Local products after sync:', 
            localProducts.map(p => ({
              id: p.id,
              quantity: p.quantity,
              synced: p.synced
            }))
          );

          // Set final status
          const finalStatus = { 
            ...statusWithTotal,
            isSyncing: false, 
            lastSyncTime: new Date(),
            currentItem: 0,
            totalItems: 0,
            syncType: null
          };
          globalProductSyncStatus = finalStatus;
        } catch (error) {
          console.error('Error syncing products:', error);
          const errorStatus = { 
            ...statusWithTotal, 
            error: 'Failed to sync products',
            isSyncing: false,
            syncType: null
          };
          globalProductSyncStatus = errorStatus;
        }
      } else {
        // No products to sync, set final status
        const finalStatus = { 
          ...statusWithTotal,
          isSyncing: false, 
          lastSyncTime: new Date(),
          currentItem: 0,
          totalItems: 0,
          syncType: null
        };
        globalProductSyncStatus = finalStatus;
      }
    } catch (err) {
      console.error('Error in product sync process:', err);
      const errorStatus = { 
        ...globalProductSyncStatus, 
        isSyncing: false, 
        error: 'Failed to process product sync queue',
        syncType: null
      };
      globalProductSyncStatus = errorStatus;
    }
  };

  await syncProducts();
};

export function useGlobalProductSync() {
  const { user, isOnline } = useAuth();
  const [syncStatus, setSyncStatus] = useState<ProductSyncStatus>({
    isSyncing: false,
    currentItem: 0,
    totalItems: 0,
    lastSyncTime: null,
    error: null,
    syncType: null
  });

  useEffect(() => {
    console.log('🔄 useGlobalProductSync hook initialized', {
      hasUser: !!user,
      isOnline,
      storeId: user?.user_metadata?.store_id
    });

    let syncInterval: NodeJS.Timeout;

    const syncProducts = async () => {
      // Skip sync if conditions aren't met
      if (!user?.user_metadata?.store_id || !isOnline) {
        console.log('⏸️ Product sync skipped - conditions not met:', {
          hasStoreId: !!user?.user_metadata?.store_id,
          isOnline
        });
        return;
      }

      console.log('🔄 Starting product sync cycle');

      try {
        const newStatus = { 
          ...syncStatus, 
          isSyncing: true, 
          error: null,
          syncType: 'products' as const
        };
        setSyncStatus(newStatus);
        globalProductSyncStatus = newStatus;

        // Get all products that need syncing (either unsynced or have quantity changes)
        const allProducts = await db.products.toArray();
        const pendingProducts = allProducts.filter(product => {
          if (product.synced === false) {
            console.log('🔄 Product needs sync:', {
              product_id: product.id,
              name: product.name,
              quantity: product.quantity
            });
            return true;
          }
          return false;
        }).sort((a, b) => 
          new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
        );

        console.log('📊 Products that need syncing:', 
          pendingProducts.map(p => ({
            id: p.id,
            name: p.name,
            quantity: p.quantity
          }))
        );

        const statusWithTotal = { ...newStatus, totalItems: pendingProducts.length };
        setSyncStatus(statusWithTotal);
        globalProductSyncStatus = statusWithTotal;

        if (pendingProducts.length > 0) {
          try {
            // Just use the current local quantities
            const productsToSync = pendingProducts.map(product => ({
              ...product,
              vat_status: typeof product.vat_status === 'string'
                ? product.vat_status === 'vatable'
                : !!product.vat_status,
              quantity: product.quantity // Use current local quantity
            }));

            console.log('🔄 Starting product sync process...');
            console.log('📊 Products to sync:', 
              productsToSync.map(p => ({
                id: p.id,
                name: p.name,
                quantity: p.quantity
              }))
            );

            // First, get existing products from Supabase
            const { data: existingProducts, error: fetchError } = await syncService.supabase
              .from('products')
              .select('id, quantity, sku')
              .in('id', productsToSync.map(p => p.id));

            if (fetchError) {
              throw fetchError;
            }

            // Also check for existing SKUs
            const { data: existingSkus, error: skuError } = await syncService.supabase
              .from('products')
              .select('id, sku')
              .in('sku', productsToSync.map(p => p.sku).filter(Boolean));

            if (skuError) {
              throw skuError;
            }

            console.log('📥 Existing products in Supabase:', 
              existingProducts?.map(p => ({
                id: p.id,
                quantity: p.quantity,
                sku: p.sku
              }))
            );

            const existingIds = new Set(existingProducts?.map(p => p.id) || []);
            const existingSkuMap = new Map(existingSkus?.map(p => [p.sku, p.id]) || []);
            
            // Split products into new and existing
            const newProducts = productsToSync.filter(p => !existingIds.has(p.id));
            const existingProductsToUpdate = productsToSync.filter(p => existingIds.has(p.id));

            // Check for SKU conflicts in new products
            const skuConflicts = newProducts.filter(p => p.sku && existingSkuMap.has(p.sku));
            if (skuConflicts.length > 0) {
              console.error('❌ SKU conflicts found:', 
                skuConflicts.map(p => ({
                  id: p.id,
                  name: p.name,
                  sku: p.sku,
                  existing_id: existingSkuMap.get(p.sku)
                }))
              );
              throw new Error(`SKU conflicts found for products: ${skuConflicts.map(p => p.name).join(', ')}`);
            }

            // Handle new products
            if (newProducts.length > 0) {
              console.log('📦 Creating new products:', 
                newProducts.map(p => ({
                  id: p.id,
                  name: p.name,
                  quantity: p.quantity
                }))
              );
              await syncService.createProductsBatch(newProducts);
              console.log('✅ New products created successfully');
            }

            // Handle existing products
            if (existingProductsToUpdate.length > 0) {
              console.log('📦 Updating existing products:', 
                existingProductsToUpdate.map(p => ({
                  id: p.id,
                  name: p.name,
                  current_quantity: p.quantity,
                  server_quantity: existingProducts?.find(ep => ep.id === p.id)?.quantity
                }))
              );

              // Calculate the actual quantity change needed
              const stockUpdates = existingProductsToUpdate.map(p => {
                const serverProduct = existingProducts?.find(ep => ep.id === p.id);
                const serverQuantity = serverProduct?.quantity || 0;
                const quantityChange = p.quantity - serverQuantity; // This is the actual change needed

                return {
                  product_id: p.id,
                  quantity_change: quantityChange
                };
              });

              await syncService.updateStockBatch(stockUpdates);
              console.log('✅ Existing products updated successfully');
            }
            
            // Prepare products for upsert with all relevant fields
            const productsUpsert = productsToSync.map(product => ({
              id: product.id,
              name: product.name,
              sku: product.sku,
              category: product.category,
              store_id: product.store_id,
              quantity: product.quantity,
              unit_of_measure: product.unit_of_measure,
              units_per_pack: product.units_per_pack,
              retail_price: product.retail_price,
              wholesale_price: product.wholesale_price,
              wholesale_threshold: product.wholesale_threshold,
              cost_price: product.cost_price,
              vat_status: product.vat_status,
              parent_product_id: product.parent_product_id,
              selling_price: product.selling_price,
              input_vat_amount: product.input_vat_amount,
            }));

            // Upsert all products (new and updated) to Supabase
            if (productsUpsert.length > 0) {
              const { error: upsertError } = await syncService.supabase
                .from('products')
                .upsert(productsUpsert, { onConflict: 'id' });
              if (upsertError) throw upsertError;
            }

            // Mark all products as synced
            await Promise.all(
              pendingProducts.map(product => 
                db.products.update(product.id, { 
                  synced: true
                })
              )
            );
            console.log('✅ Local products marked as synced');

            // Verify final state
            const { data: finalProducts } = await syncService.supabase
              .from('products')
              .select('id, quantity')
              .in('id', productsToSync.map(p => p.id));

            console.log('📊 Final product quantities in Supabase:', 
              finalProducts?.map(p => ({
                id: p.id,
                quantity: p.quantity
              }))
            );

            // Get local products after sync
            const localProducts = await db.products
              .where('id')
              .anyOf(productsToSync.map(p => p.id))
              .toArray();

            console.log('📊 Local products after sync:', 
              localProducts.map(p => ({
                id: p.id,
                quantity: p.quantity,
                synced: p.synced
              }))
            );

            // Set final status
            const finalStatus = { 
              ...statusWithTotal,
              isSyncing: false, 
              lastSyncTime: new Date(),
              currentItem: 0,
              totalItems: 0,
              syncType: null
            };
            setSyncStatus(finalStatus);
            globalProductSyncStatus = finalStatus;
          } catch (error) {
            console.error('Error syncing products:', error);
            const errorStatus = { 
              ...statusWithTotal, 
              error: 'Failed to sync products',
              isSyncing: false,
              syncType: null
            };
            setSyncStatus(errorStatus);
            globalProductSyncStatus = errorStatus;
          }
        } else {
          // No products to sync, set final status
          const finalStatus = { 
            ...statusWithTotal,
            isSyncing: false, 
            lastSyncTime: new Date(),
            currentItem: 0,
            totalItems: 0,
            syncType: null
          };
          setSyncStatus(finalStatus);
          globalProductSyncStatus = finalStatus;
        }
      } catch (err) {
        console.error('Error in product sync process:', err);
        const errorStatus = { 
          ...syncStatus, 
          isSyncing: false, 
          error: 'Failed to process product sync queue',
          syncType: null
        };
        setSyncStatus(errorStatus);
        globalProductSyncStatus = errorStatus;
      }
    };

    if (isOnline && user?.user_metadata?.store_id) {
      syncProducts();
    }

    if (isOnline) {
      syncInterval = setInterval(syncProducts, 5 * 60 * 1000);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isOnline, user?.user_metadata?.store_id]);

  return syncStatus;
} 