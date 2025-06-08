import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { db } from '@/lib/db';
import { syncService } from '@/lib/sync';
import type { Database } from '@/types/supabase';

type Product = Database['public']['Tables']['products']['Row'];

export interface ProductSyncStatus {
  isSyncing: boolean;
  currentItem: number;
  totalItems: number;
  lastSyncTime: Date | null;
  error: string | null;
  syncType: 'products' | 'stock' | null;
}

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
    let syncInterval: NodeJS.Timeout;

    const syncProducts = async () => {
      if (!user?.user_metadata?.store_id || !isOnline) return;

      try {
        setSyncStatus(prev => ({ 
          ...prev, 
          isSyncing: true, 
          error: null,
          syncType: 'products'
        }));

        // Get pending products ordered by creation time
        const pendingProducts = await db.products
          .filter(product => product.synced === false)
          .toArray()
          .then(products => 
            products.sort((a, b) => 
              new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
            )
          );

        setSyncStatus(prev => ({ ...prev, totalItems: pendingProducts.length }));

        if (pendingProducts.length > 0) {
          try {
            // Just use the current local quantities
            const productsToSync = pendingProducts.map(product => ({
              ...product,
              quantity: product.quantity // Use current local quantity
            }));

            console.log('📊 Syncing products with current quantities:', 
              productsToSync.map(p => ({
                id: p.id,
                name: p.name,
                quantity: p.quantity
              }))
            );

            await syncService.createProductsBatch(productsToSync);
            
            // Update local products as synced
            await Promise.all(
              pendingProducts.map(product => 
                db.products.update(product.id, { synced: true })
              )
            );
          } catch (error) {
            console.error('Error syncing products:', error);
            setSyncStatus(prev => ({ 
              ...prev, 
              error: 'Failed to sync products'
            }));
          }
        }

        setSyncStatus(prev => ({ 
          ...prev, 
          isSyncing: false, 
          lastSyncTime: new Date(),
          currentItem: 0,
          totalItems: 0,
          syncType: null
        }));
      } catch (err) {
        console.error('Error in product sync process:', err);
        setSyncStatus(prev => ({ 
          ...prev, 
          isSyncing: false, 
          error: 'Failed to process product sync queue',
          syncType: null
        }));
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