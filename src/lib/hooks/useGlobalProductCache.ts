import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { cacheProducts } from '../db';
import { useAuth } from '@/components/providers/AuthProvider';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useGlobalProductCache() {
  const { user, isOnline } = useAuth();

  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    const syncProducts = async () => {
      if (!user?.user_metadata?.store_id || !isOnline) return;

      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('store_id', user.user_metadata.store_id);

        if (error) throw error;

        // Cache products for offline use
        await cacheProducts(data);
        console.log('Products cached successfully for offline use');
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