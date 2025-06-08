import { useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { syncService } from '@/lib/sync';

export function useGlobalProductCache() {
  const { user, isOnline } = useAuth();

  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    const syncProducts = async () => {
      if (!user?.user_metadata?.store_id || !isOnline) return;

      try {
        // Use SyncService to fetch and cache products
        await syncService.getProducts(user.user_metadata.store_id);
        console.log('✅ Products cached successfully for offline use');
      } catch (err) {
        console.error('Failed to cache products:', err);
      }
    };

    // Initial sync when online
    if (isOnline && user?.user_metadata?.store_id) {
      syncProducts();
    }

    // Set up periodic sync every 5 minutes when online
    if (isOnline) {
      syncInterval = setInterval(syncProducts, 5 * 60 * 1000);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isOnline, user?.user_metadata?.store_id]);
} 