import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { getModeManager } from '@/lib/mode/ModeManager';
import { getUnifiedService } from '@/lib/services/UnifiedService';
import { Database } from '@/types/supabase';

export interface ProductSyncStatus {
  isSyncing: boolean;
  currentItem: number;
  totalItems: number;
  lastSyncTime: Date | null;
  error: string | null;
  syncType: 'products' | 'stock' | null;
  currentMode: 'offline' | 'online';
}

export function useUnifiedProducts(storeId: string) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Database['public']['Tables']['products']['Row'][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  const [syncStatus, setSyncStatus] = useState<ProductSyncStatus>({
    isSyncing: false,
    currentItem: 0,
    totalItems: 0,
    lastSyncTime: null,
    error: null,
    syncType: null,
    currentMode: 'online'
  });

  const modeManager = getModeManager();
  const unifiedService = getUnifiedService(modeManager);

  // Listen for mode changes
  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      setCurrentMode(newMode);
      setSyncStatus(prev => ({ ...prev, currentMode: newMode }));
      console.log(`🔄 Products hook: Mode changed to ${newMode}`);
      
      // Refresh data when mode changes
      fetchProducts();
    };

    // Set initial mode
    setCurrentMode(modeManager.getCurrentMode());
    setSyncStatus(prev => ({ ...prev, currentMode: modeManager.getCurrentMode() }));

    window.addEventListener('modeChange', handleModeChange as EventListener);
    
    return () => {
      window.removeEventListener('modeChange', handleModeChange as EventListener);
    };
  }, [modeManager]);

  // Real-time subscriptions (only for online mode)
  useEffect(() => {
    if (currentMode === 'online' && storeId) {
      console.log('🔄 Setting up real-time product subscriptions');
      
      const channel = unifiedService.subscribeToProducts(storeId, (payload) => {
        console.log('🔄 Real-time product update:', payload);
        handleProductChange(payload);
      });

      return () => {
        if (channel) {
          console.log('🔄 Cleaning up real-time product subscriptions');
          // Note: Supabase channel cleanup is handled automatically
        }
      };
    }
  }, [currentMode, storeId, unifiedService]);

  const handleProductChange = useCallback((payload: any) => {
    setProducts(prevProducts => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      switch (eventType) {
        case 'INSERT':
          return [...prevProducts, newRecord];
        case 'UPDATE':
          return prevProducts.map(product => 
            product.id === newRecord.id ? newRecord : product
          );
        case 'DELETE':
          return prevProducts.filter(product => product.id !== oldRecord.id);
        default:
          return prevProducts;
      }
    });
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!storeId) return;

    try {
      setIsLoading(true);
      setError(null);
      console.log(`🔄 Fetching products in ${currentMode} mode`);
      
      const data = await unifiedService.getProducts(storeId);
      setProducts(data);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      console.log(`✅ Fetched ${data.length} products in ${currentMode} mode`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, currentMode, unifiedService]);

  const updateProduct = useCallback(async (productId: string, updates: Partial<Database['public']['Tables']['products']['Update']>) => {
    try {
      setError(null);
      console.log(`🔄 Updating product in ${currentMode} mode`);
      
      const result = await unifiedService.updateProduct(productId, updates);
      
      // Update local state
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === productId ? result : product
        )
      );
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update product';
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error updating product:', err);
      throw err;
    }
  }, [currentMode, unifiedService]);

  const createProduct = useCallback(async (productData: any) => {
    try {
      setError(null);
      console.log(`🔄 Creating product in ${currentMode} mode`);
      
      const result = await unifiedService.createProduct(productData);
      
      // Add to local state
      setProducts(prevProducts => [...prevProducts, result]);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create product';
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error creating product:', err);
      throw err;
    }
  }, [currentMode, unifiedService]);

  const updateStock = useCallback(async (productId: string, quantityChange: number, version?: number) => {
    try {
      setError(null);
      console.log(`🔄 Updating stock in ${currentMode} mode`);
      
      const result = await unifiedService.updateStock(productId, quantityChange, version);
      
      // Update local state
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === productId ? result : product
        )
      );
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update stock';
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error updating stock:', err);
      throw err;
    }
  }, [currentMode, unifiedService]);

  // Initial fetch
  useEffect(() => {
    if (storeId && user) {
      fetchProducts();
    }
  }, [storeId, user, fetchProducts]);

  // Periodic sync for offline mode
  useEffect(() => {
    if (currentMode === 'offline' && storeId) {
      const syncInterval = setInterval(async () => {
        try {
          const pendingCount = await unifiedService.getPendingSyncCount();
          if (pendingCount > 0) {
            console.log(`🔄 Syncing ${pendingCount} pending items`);
            setSyncStatus(prev => ({ ...prev, isSyncing: true }));
            
            await unifiedService.syncPendingData();
            
            setSyncStatus(prev => ({ 
              ...prev, 
              isSyncing: false,
              lastSyncTime: new Date()
            }));
            
            // Refresh products after sync
            fetchProducts();
          }
        } catch (err) {
          console.error('❌ Error during periodic sync:', err);
          setSyncStatus(prev => ({ 
            ...prev, 
            isSyncing: false,
            error: 'Sync failed'
          }));
        }
      }, 60000); // Sync every minute

      return () => clearInterval(syncInterval);
    }
  }, [currentMode, storeId, unifiedService, fetchProducts]);

  return {
    products,
    isLoading,
    error,
    currentMode,
    syncStatus,
    fetchProducts,
    updateProduct,
    createProduct,
    updateStock,
    // Mode-specific utilities
    isOnlineMode: unifiedService.isOnlineMode(),
    isOfflineMode: unifiedService.isOfflineMode(),
    getPendingSyncCount: unifiedService.getPendingSyncCount.bind(unifiedService),
    syncPendingData: unifiedService.syncPendingData.bind(unifiedService)
  };
} 