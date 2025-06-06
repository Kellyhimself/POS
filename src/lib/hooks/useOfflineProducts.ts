"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { cacheProducts, getCachedProducts } from '../db';
import type { OfflineProduct } from '../db';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useOfflineProducts(store_id: string) {
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<OfflineProduct[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadProducts = useCallback(async () => {
    if (!store_id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Always try to load from cache first
      const cachedProducts = await getCachedProducts(store_id);
      setProducts(cachedProducts);

      // If online, fetch fresh data
      if (isOnline) {
        const { data, error: supabaseError } = await supabase
          .from('products')
          .select('*')
          .eq('store_id', store_id);

        if (supabaseError) throw supabaseError;

        // Update cache and state with fresh data
        await cacheProducts(data);
        setProducts(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      // If online fetch fails, we already have cached data
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, store_id]);

  const syncProducts = useCallback(async () => {
    if (!isOnline || !store_id) return;

    try {
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', store_id);

      if (supabaseError) throw supabaseError;

      await cacheProducts(data);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync products');
    }
  }, [isOnline, store_id]);

  // Load products on mount and when online status changes
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncProducts();
    }
  }, [isOnline, syncProducts]);

  return {
    products,
    isLoading,
    error,
    isOnline,
    refresh: loadProducts,
    sync: syncProducts
  };
} 