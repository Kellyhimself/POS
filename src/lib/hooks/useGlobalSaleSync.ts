import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { db } from '@/lib/db';
import { syncService } from '@/lib/sync';
import { getProductSyncStatus } from './useGlobalProductSync';

export interface SyncStatus {
  isSyncing: boolean;
  currentItem: number;
  totalItems: number;
  lastSyncTime: Date | null;
  error: string | null;
}

// Create a module-level variable to store the sync status
let globalSaleSyncStatus: SyncStatus = {
  isSyncing: false,
  currentItem: 0,
  totalItems: 0,
  lastSyncTime: null,
  error: null
};

// Function to get the current sync status
export const getSaleSyncStatus = () => globalSaleSyncStatus;

export function useGlobalSaleSync() {
  const { user, isOnline } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    currentItem: 0,
    totalItems: 0,
    lastSyncTime: null,
    error: null
  });
  const syncInProgress = useRef(false);

  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    const syncSales = async () => {
      console.log('🔄 Sync attempt started:', {
        syncInProgress: syncInProgress.current,
        hasStoreId: !!user?.user_metadata?.store_id,
        isOnline,
        lastSyncTime: globalSaleSyncStatus.lastSyncTime,
        currentStatus: globalSaleSyncStatus
      });

      // Skip if already syncing or conditions aren't met
      if (syncInProgress.current) {
        console.log('⏸️ Sync prevented - sync already in progress');
        return;
      }

      if (!user?.user_metadata?.store_id) {
        console.log('⏸️ Sync prevented - no store ID');
        return;
      }

      if (!isOnline) {
        console.log('⏸️ Sync prevented - offline');
        return;
      }

      // Don't start sale sync if product sync is in progress
      const productSyncStatus = getProductSyncStatus();
      if (productSyncStatus.isSyncing) {
        console.log('⏳ Waiting for product sync to complete...', {
          productSyncStatus: {
            isSyncing: productSyncStatus.isSyncing,
            currentItem: productSyncStatus.currentItem,
            totalItems: productSyncStatus.totalItems
          }
        });
        // Retry after a short delay
        setTimeout(syncSales, 1000);
        return;
      }

      // If product sync failed, wait for next cycle
      if (productSyncStatus.error) {
        console.log('⏳ Product sync failed, waiting for next cycle...', {
          error: productSyncStatus.error
        });
        return;
      }

      try {
        console.log('🔒 Acquiring sync lock');
        syncInProgress.current = true;
        setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));
        globalSaleSyncStatus = { ...syncStatus, isSyncing: true, error: null };
        
        // First check if there are any pending products
        const pendingProducts = await db.products
          .filter(product => product.synced === false)
          .toArray();

        if (pendingProducts.length > 0) {
          console.log('⏳ Skipping sale sync - pending products exist:', {
            pendingProductsCount: pendingProducts.length,
            productIds: pendingProducts.map(p => p.id)
          });
          setSyncStatus(prev => ({ 
            ...prev, 
            isSyncing: false,
            error: 'Pending products need to be synced first'
          }));
          globalSaleSyncStatus = { ...syncStatus, isSyncing: false, error: 'Pending products need to be synced first' };
          // Retry after a short delay
          setTimeout(syncSales, 1000);
          return;
        }

        // Get all pending transactions ordered by creation time
        const pendingTransactions = await db.transactions
          .filter(transaction => transaction.synced === false)
          .toArray()
          .then(transactions => 
            transactions.sort((a, b) => 
              new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
            )
          );

        console.log('📊 Found pending transactions:', {
          count: pendingTransactions.length,
          transactionIds: pendingTransactions.map(t => t.id)
        });

        setSyncStatus(prev => ({ ...prev, totalItems: pendingTransactions.length }));
        globalSaleSyncStatus = { ...syncStatus, totalItems: pendingTransactions.length };
        
        for (const [index, transaction] of pendingTransactions.entries()) {
          try {
            setSyncStatus(prev => ({ ...prev, currentItem: index + 1 }));
            globalSaleSyncStatus = { ...syncStatus, currentItem: index + 1 };
            
            // Double check if transaction is still unsynced
            const currentTransaction = await db.transactions.get(transaction.id);
            if (!currentTransaction || currentTransaction.synced) {
              console.log('⏭️ Skipping already synced transaction:', {
                transaction_id: transaction.id,
                exists: !!currentTransaction,
                synced: currentTransaction?.synced
              });
              continue;
            }

            // Get sale items for this transaction
            const saleItems = await db.sale_items
              .where('sale_id')
              .equals(transaction.id)
              .toArray();

            console.log('📦 Raw sale items from DB:', {
              transaction_id: transaction.id,
              items_count: saleItems.length,
              items: saleItems.map(item => ({
                id: item.id,
                product_id: item.product_id,
                quantity: item.quantity
              }))
            });

            const productsForSync = saleItems.map(item => ({
              id: item.product_id,
              quantity: item.quantity,
              displayPrice: item.price,
              vat_amount: item.vat_amount
            }));

            console.log('🔄 Preparing to sync transaction:', {
              transaction_id: transaction.id,
              store_id: transaction.store_id,
              timestamp: transaction.timestamp,
              timestamp_local_ke: new Date(transaction.timestamp).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
              timestamp_utc: new Date(transaction.timestamp).toUTCString(),
              current_time: {
                iso: new Date().toISOString(),
                local_ke: new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
                utc: new Date().toUTCString()
              },
              time_difference: {
                hours: (new Date(transaction.timestamp).getTime() - new Date().getTime()) / (1000 * 60 * 60),
                minutes: (new Date(transaction.timestamp).getTime() - new Date().getTime()) / (1000 * 60)
              },
              payment_method: transaction.payment_method,
              total_amount: transaction.total_amount,
              vat_total: transaction.vat_total,
              products: productsForSync,
              products_length: productsForSync.length,
              products_json: JSON.stringify(productsForSync)
            });

            try {
              // Validate products array before RPC call
              if (!productsForSync || productsForSync.length === 0) {
                throw new Error('No products found for transaction');
              }

              // Log the exact data being sent to RPC
              console.log('📤 Calling create_sale RPC with data:', {
                store_id: transaction.store_id,
                products: productsForSync,
                payment_method: transaction.payment_method,
                total_amount: transaction.total_amount,
                vat_total: transaction.vat_total,
                timestamp: transaction.timestamp,
                timestamp_details: {
                  original: transaction.timestamp,
                  parsed: new Date(transaction.timestamp).toISOString(),
                  local_ke: new Date(transaction.timestamp).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
                  utc: new Date(transaction.timestamp).toUTCString()
                }
              });

              // Call createSale RPC through syncService
              const { data: transactionId, error } = await syncService.createSale({
                store_id: transaction.store_id,
                products: productsForSync,
                payment_method: transaction.payment_method as 'cash' | 'mpesa',
                total_amount: transaction.total_amount,
                vat_total: transaction.vat_total,
                timestamp: transaction.timestamp
              });

              if (error) {
                console.error('❌ Error syncing transaction:', {
                  transaction_id: transaction.id,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  details: error instanceof Error ? error.stack : undefined
                });
                throw error;
              }

              if (!transactionId) {
                console.error('❌ No transaction ID returned from RPC:', {
                  transaction_id: transaction.id,
                  response: { data: transactionId, error }
                });
                throw new Error('No transaction ID returned from RPC');
              }

              console.log('✅ Successfully synced transaction:', {
                transaction_id: transaction.id,
                server_transaction_id: transactionId
              });

              // Mark transaction as synced
              await db.transactions.update(transaction.id, { synced: true });
              console.log('✅ Marked transaction as synced:', {
                transaction_id: transaction.id,
                server_transaction_id: transactionId
              });

              // Verify the sync
              const { data: syncedTransaction, error: verifyError } = await syncService.getTransaction(transactionId);

              if (verifyError) {
                console.error('❌ Error verifying sync:', {
                  transaction_id: transaction.id,
                  server_transaction_id: transactionId,
                  error: verifyError instanceof Error ? verifyError.message : 'Unknown error'
                });
              } else {
                console.log('✅ Verified sync in database:', {
                  transaction_id: transaction.id,
                  server_transaction_id: transactionId,
                  synced_data: syncedTransaction
                });
              }
            } catch (error) {
              console.error('❌ Error in sync process:', {
                transaction_id: transaction.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
              });
              throw error;
            }
          } catch (error) {
            console.error('Error syncing transaction:', error);
            setSyncStatus(prev => ({ 
              ...prev, 
              error: `Failed to sync transaction ${index + 1}`
            }));
            globalSaleSyncStatus = { ...syncStatus, error: `Failed to sync transaction ${index + 1}` };
          }
        }

        console.log('✅ Sync cycle completed:', {
          lastSyncTime: new Date(),
          totalTransactionsProcessed: pendingTransactions.length
        });

        setSyncStatus(prev => ({ 
          ...prev, 
          isSyncing: false, 
          lastSyncTime: new Date(),
          currentItem: 0,
          totalItems: 0
        }));
        globalSaleSyncStatus = { 
          ...syncStatus, 
          isSyncing: false, 
          lastSyncTime: new Date(),
          currentItem: 0,
          totalItems: 0
        };
      } catch (err) {
        console.error('Error in sync process:', err);
        setSyncStatus(prev => ({ 
          ...prev, 
          isSyncing: false, 
          error: 'Failed to process sync queue'
        }));
        globalSaleSyncStatus = { 
          ...syncStatus, 
          isSyncing: false, 
          error: 'Failed to process sync queue'
        };
      } finally {
        console.log('🔓 Releasing sync lock');
        syncInProgress.current = false;
      }
    };

    const setupSync = async () => {
      if (isOnline && user?.user_metadata?.store_id) {
        console.log('🔄 Initial sync triggered:', {
          store_id: user.user_metadata.store_id,
          isOnline
        });

        // Check if sync is already in progress
        if (syncInProgress.current) {
          console.log('⏸️ Initial sync prevented - sync already in progress');
          return;
        }

        await syncSales();
        
        // Only set up interval after initial sync completes and if still online
        if (isOnline && !syncInProgress.current) {
          console.log('⏰ Setting up sync interval');
          syncInterval = setInterval(syncSales, 5 * 60 * 1000);
        }
      }
    };

    setupSync();

    return () => {
      if (syncInterval) {
        console.log('🧹 Cleaning up sync interval');
        clearInterval(syncInterval);
      }
    };
  }, [isOnline, user?.user_metadata?.store_id]);

  return syncStatus;
} 