import { useEffect, useState, useCallback, useRef } from 'react';
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
  console.log('🔄 useUnifiedProducts: Hook called with storeId:', storeId);
  
  const { user } = useAuth();
  console.log('🔄 useUnifiedProducts: User from auth:', user ? 'Authenticated' : 'Not authenticated');
  
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

  console.log('🔄 useUnifiedProducts: State initialized', { 
    productsCount: products.length, 
    isLoading, 
    error, 
    currentMode 
  });

  // Use refs to store singleton instances to prevent recreation
  const modeManagerRef = useRef<ReturnType<typeof getModeManager> | null>(null);
  const unifiedServiceRef = useRef<ReturnType<typeof getUnifiedService> | null>(null);

  // Initialize singletons once
  if (!modeManagerRef.current) {
    console.log('🔄 useUnifiedProducts: Initializing mode manager');
    modeManagerRef.current = getModeManager();
    console.log('✅ useUnifiedProducts: Mode manager initialized');
  }

  if (!unifiedServiceRef.current && modeManagerRef.current) {
    console.log('🔄 useUnifiedProducts: Initializing unified service');
    unifiedServiceRef.current = getUnifiedService(modeManagerRef.current);
    console.log('✅ useUnifiedProducts: Unified service initialized');
  }

  const isInitialized = useRef(false);

  // Define handleProductChange before using it in useEffect
  const handleProductChange = useCallback((payload: Record<string, unknown>) => {
    console.log('🔄 useUnifiedProducts: Handling product change:', payload);
    setProducts(prevProducts => {
      const { eventType, new: newRecord, old: oldRecord } = payload as {
        eventType: string;
        new: Database['public']['Tables']['products']['Row'];
        old: Database['public']['Tables']['products']['Row'];
      };
      
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

  // Listen for mode changes
  useEffect(() => {
    console.log('🔄 useUnifiedProducts: Mode change useEffect running');
    
    if (!modeManagerRef.current) {
      console.log('❌ useUnifiedProducts: Mode manager not available');
      return;
    }

    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      console.log('🔄 useUnifiedProducts: Mode change event received:', newMode);
      setCurrentMode(newMode);
      setSyncStatus(prev => ({ ...prev, currentMode: newMode }));
      console.log(`🔄 Products hook: Mode changed to ${newMode}`);
      
      // Refresh data when mode changes
      if (isInitialized.current) {
        console.log('🔄 useUnifiedProducts: Refreshing products due to mode change');
        // Use setTimeout to avoid calling during render
        setTimeout(() => {
          fetchProductsRef.current?.();
        }, 0);
      }
    };

    // Set initial mode
    const initialMode = modeManagerRef.current.getCurrentMode();
    console.log('🔄 useUnifiedProducts: Setting initial mode:', initialMode);
    setCurrentMode(initialMode);
    setSyncStatus(prev => ({ ...prev, currentMode: initialMode }));

    window.addEventListener('modeChange', handleModeChange as EventListener);
    console.log('✅ useUnifiedProducts: Mode change listener added');
    
    return () => {
      console.log('🔄 useUnifiedProducts: Cleaning up mode change listener');
      window.removeEventListener('modeChange', handleModeChange as EventListener);
    };
  }, []); // Empty dependency array since we're using refs

  // Real-time subscriptions (only for online mode)
  useEffect(() => {
    console.log('🔄 useUnifiedProducts: Real-time subscription useEffect running', { 
      currentMode, 
      storeId, 
      hasUnifiedService: !!unifiedServiceRef.current 
    });
    
    if (currentMode === 'online' && storeId && unifiedServiceRef.current) {
      console.log('🔄 Setting up real-time product subscriptions');
      
      // Use a stable callback to prevent subscription recreation
      const stableCallback = (payload: Record<string, unknown>) => {
        console.log('🔄 Real-time product update:', payload);
        handleProductChange(payload);
      };
      
      const channel = unifiedServiceRef.current.subscribeToProducts(storeId, stableCallback);

      return () => {
        if (channel) {
          console.log('🔄 Cleaning up real-time product subscriptions');
          // Note: Supabase channel cleanup is handled automatically
        }
      };
    }
  }, [currentMode, storeId, handleProductChange]); // Include handleProductChange in dependencies

  // Create a ref to store the fetchProducts function to avoid recreation
  const fetchProductsRef = useRef<() => Promise<void>>();

  const fetchProducts = useCallback(async () => {
    console.log('🔄 useUnifiedProducts: fetchProducts called', { storeId, currentMode });
    
    if (!storeId || !unifiedServiceRef.current) {
      console.log('❌ useUnifiedProducts: Cannot fetch products - missing storeId or unifiedService');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log(`🔄 Fetching products in ${currentMode} mode`);
      
      const data = await unifiedServiceRef.current.getProducts(storeId);
      console.log('✅ useUnifiedProducts: Products fetched successfully:', data.length);
      setProducts(data);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      console.log(`✅ Fetched ${data.length} products in ${currentMode} mode`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products';
      console.error('❌ useUnifiedProducts: Error fetching products:', err);
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [storeId]); // Remove currentMode from dependencies to prevent recreation

  // Store the fetchProducts function in a ref
  fetchProductsRef.current = fetchProducts;

  const updateProduct = useCallback(async (productId: string, updates: Partial<Database['public']['Tables']['products']['Update']>) => {
    console.log('🔄 useUnifiedProducts: updateProduct called', { productId, updates });
    
    if (!unifiedServiceRef.current) throw new Error('Unified service not initialized');

    try {
      setError(null);
      console.log(`🔄 Updating product in ${currentMode} mode`);
      
      const result = await unifiedServiceRef.current.updateProduct(productId, updates);
      
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
  }, [currentMode]);

  const createProduct = useCallback(async (productData: any) => {
    console.log('🔄 useUnifiedProducts: createProduct called', { productData });
    
    if (!unifiedServiceRef.current) throw new Error('Unified service not initialized');

    try {
      setError(null);
      console.log(`🔄 Creating product in ${currentMode} mode`);
      
      const result = await unifiedServiceRef.current.createProduct(productData);
      
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
  }, [currentMode]);

  const updateStock = useCallback(async (productId: string, quantityChange: number, version?: number) => {
    console.log('🔄 useUnifiedProducts: updateStock called', { productId, quantityChange, version });
    
    if (!unifiedServiceRef.current) throw new Error('Unified service not initialized');

    try {
      setError(null);
      console.log(`🔄 Updating stock in ${currentMode} mode`);
      
      const result = await unifiedServiceRef.current.updateStock(productId, quantityChange, version);
      
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
  }, [currentMode]);

  // Initial fetch - only run once when storeId and user are available
  useEffect(() => {
    console.log('🔄 useUnifiedProducts: Initial fetch useEffect running', { 
      storeId, 
      hasUser: !!user, 
      isInitialized: isInitialized.current 
    });
    
    if (storeId && user && !isInitialized.current) {
      console.log('🔄 useUnifiedProducts: Initializing and fetching products');
      isInitialized.current = true;
      // Use setTimeout to avoid calling fetchProducts during render
      setTimeout(() => {
        fetchProductsRef.current?.();
      }, 0);
    }
  }, [storeId, user]); // Removed fetchProducts from dependencies

  // Periodic sync for offline mode
  useEffect(() => {
    console.log('🔄 useUnifiedProducts: Periodic sync useEffect running', { 
      currentMode, 
      storeId, 
      isInitialized: isInitialized.current,
      hasUnifiedService: !!unifiedServiceRef.current
    });
    
    if (currentMode === 'offline' && storeId && isInitialized.current && unifiedServiceRef.current) {
      console.log('🔄 useUnifiedProducts: Setting up periodic sync interval');
      
      const syncInterval = setInterval(async () => {
        try {
          const pendingCount = await unifiedServiceRef.current!.getPendingSyncCount();
          if (pendingCount > 0) {
            console.log(`🔄 Syncing ${pendingCount} pending items`);
            setSyncStatus(prev => ({ ...prev, isSyncing: true }));
            
            await unifiedServiceRef.current!.syncPendingData();
            
            setSyncStatus(prev => ({ 
              ...prev, 
              isSyncing: false,
              lastSyncTime: new Date()
            }));
            
            // Refresh products after sync
            fetchProductsRef.current?.();
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

      return () => {
        console.log('🔄 useUnifiedProducts: Cleaning up periodic sync interval');
        clearInterval(syncInterval);
      };
    }
  }, [currentMode, storeId]); // Removed fetchProducts from dependencies

  console.log('🔄 useUnifiedProducts: Returning hook result');
  
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
    isOnlineMode: unifiedServiceRef.current?.isOnlineMode() || false,
    isOfflineMode: unifiedServiceRef.current?.isOfflineMode() || false,
    getPendingSyncCount: unifiedServiceRef.current?.getPendingSyncCount.bind(unifiedServiceRef.current) || (() => Promise.resolve(0)),
    syncPendingData: unifiedServiceRef.current?.syncPendingData.bind(unifiedServiceRef.current) || (() => Promise.resolve())
  };
} 