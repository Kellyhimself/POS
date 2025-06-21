import { useEffect, useState, useCallback, useRef } from 'react';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import { getModeManager } from '@/lib/mode/ModeManager';
import { getUnifiedService } from '@/lib/services/UnifiedService';
import { Database } from '@/types/supabase';

export interface SaleSyncStatus {
  isSyncing: boolean;
  currentItem: number;
  totalItems: number;
  lastSyncTime: Date | null;
  error: string | null;
  currentMode: 'offline' | 'online';
}

export interface CreateSaleInput {
  store_id: string;
  user_id: string;
  products: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    vat_amount: number;
  }>;
  payment_method: 'cash' | 'mpesa';
  total_amount: number;
  vat_total: number;
}

export function useUnifiedSales(storeId: string) {
  console.log('🔄 useUnifiedSales: Hook called with storeId:', storeId);
  
  const { user } = useSimplifiedAuth();
  console.log('🔄 useUnifiedSales: User from auth:', user ? 'Authenticated' : 'Not authenticated');
  
  const [transactions, setTransactions] = useState<Database['public']['Tables']['transactions']['Row'][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  const [syncStatus, setSyncStatus] = useState<SaleSyncStatus>({
    isSyncing: false,
    currentItem: 0,
    totalItems: 0,
    lastSyncTime: null,
    error: null,
    currentMode: 'online'
  });

  console.log('🔄 useUnifiedSales: State initialized', { 
    transactionsCount: transactions.length, 
    isLoading, 
    error, 
    currentMode 
  });

  // Use refs to store singleton instances to prevent recreation
  const modeManagerRef = useRef<ReturnType<typeof getModeManager> | null>(null);
  const unifiedServiceRef = useRef<ReturnType<typeof getUnifiedService> | null>(null);

  // Initialize singletons once
  if (!modeManagerRef.current) {
    console.log('🔄 useUnifiedSales: Initializing mode manager');
    modeManagerRef.current = getModeManager();
    console.log('✅ useUnifiedSales: Mode manager initialized');
  }

  if (!unifiedServiceRef.current && modeManagerRef.current) {
    console.log('🔄 useUnifiedSales: Initializing unified service');
    unifiedServiceRef.current = getUnifiedService(modeManagerRef.current);
    console.log('✅ useUnifiedSales: Unified service initialized');
  }

  const isInitialized = useRef(false);

  // Define handleTransactionChange before using it in useEffect
  const handleTransactionChange = useCallback((payload: Record<string, unknown>) => {
    console.log('🔄 useUnifiedSales: Handling transaction change:', payload);
    setTransactions(prevTransactions => {
      const { eventType, new: newRecord, old: oldRecord } = payload as {
        eventType: string;
        new: Database['public']['Tables']['transactions']['Row'];
        old: Database['public']['Tables']['transactions']['Row'];
      };
      
      switch (eventType) {
        case 'INSERT':
          return [newRecord, ...prevTransactions];
        case 'UPDATE':
          return prevTransactions.map(transaction => 
            transaction.id === newRecord.id ? newRecord : transaction
          );
        case 'DELETE':
          return prevTransactions.filter(transaction => transaction.id !== oldRecord.id);
        default:
          return prevTransactions;
      }
    });
  }, []);

  // Listen for mode changes
  useEffect(() => {
    console.log('🔄 useUnifiedSales: Mode change useEffect running');
    
    if (!modeManagerRef.current) {
      console.log('❌ useUnifiedSales: Mode manager not available');
      return;
    }

    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      console.log('🔄 useUnifiedSales: Mode change event received:', newMode);
      setCurrentMode(newMode);
      setSyncStatus(prev => ({ ...prev, currentMode: newMode }));
      console.log(`🔄 Sales hook: Mode changed to ${newMode}`);
    };

    // Set initial mode
    const initialMode = modeManagerRef.current.getCurrentMode();
    console.log('🔄 useUnifiedSales: Setting initial mode:', initialMode);
    setCurrentMode(initialMode);
    setSyncStatus(prev => ({ ...prev, currentMode: initialMode }));

    window.addEventListener('modeChange', handleModeChange as EventListener);
    console.log('✅ useUnifiedSales: Mode change listener added');
    
    return () => {
      console.log('🔄 useUnifiedSales: Cleaning up mode change listener');
      window.removeEventListener('modeChange', handleModeChange as EventListener);
    };
  }, []); // Empty dependency array since we're using refs

  // Real-time subscriptions (only for online mode)
  useEffect(() => {
    console.log('🔄 useUnifiedSales: Real-time subscription useEffect running', { 
      currentMode, 
      storeId, 
      hasUnifiedService: !!unifiedServiceRef.current 
    });
    
    if (currentMode === 'online' && storeId && unifiedServiceRef.current) {
      console.log('🔄 Setting up real-time transaction subscriptions');
      
      // Use a stable callback to prevent subscription recreation
      const stableCallback = (payload: Record<string, unknown>) => {
        console.log('🔄 Real-time transaction update:', payload);
        handleTransactionChange(payload);
      };
      
      const channel = unifiedServiceRef.current.subscribeToTransactions(storeId, stableCallback);

      return () => {
        if (channel) {
          console.log('🔄 Cleaning up real-time transaction subscriptions');
          // Note: Supabase channel cleanup is handled automatically
        }
      };
    }
  }, [currentMode, storeId, handleTransactionChange]); // Include handleTransactionChange in dependencies

  const fetchTransactions = useCallback(async (startDate?: Date, endDate?: Date) => {
    console.log('🔄 useUnifiedSales: fetchTransactions called', { storeId, currentMode, startDate, endDate });
    
    if (!storeId || !unifiedServiceRef.current) {
      console.log('❌ useUnifiedSales: Cannot fetch transactions - missing storeId or unifiedService');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log(`🔄 Fetching transactions in ${currentMode} mode`);
      
      const data = await unifiedServiceRef.current.getTransactions(storeId, startDate, endDate);
      console.log('✅ useUnifiedSales: Transactions fetched successfully:', data.length);
      setTransactions(data);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      console.log(`✅ Fetched ${data.length} transactions in ${currentMode} mode`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch transactions';
      console.error('❌ useUnifiedSales: Error fetching transactions:', err);
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [storeId]); // Remove currentMode from dependencies to prevent recreation

  const createSale = useCallback(async (saleData: CreateSaleInput): Promise<Database['public']['Tables']['transactions']['Row']> => {
    console.log('🔄 useUnifiedSales: createSale called', { saleData });
    
    if (!unifiedServiceRef.current) throw new Error('Unified service not initialized');

    try {
      setError(null);
      console.log(`🔄 Creating sale in ${currentMode} mode`);
      
      const result = await unifiedServiceRef.current.createSale(saleData);
      
      // Add to local state (only if not already present from real-time subscription)
      setTransactions(prevTransactions => {
        const exists = prevTransactions.some(t => t.id === result.id);
        if (!exists) {
          return [result, ...prevTransactions];
        }
        return prevTransactions;
      });
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      console.log(`✅ Sale created successfully in ${currentMode} mode`);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create sale';
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error creating sale:', err);
      throw err;
    }
  }, [currentMode]);

  const submitToETIMS = useCallback(async (invoiceData: Record<string, unknown>) => {
    console.log('🔄 useUnifiedSales: submitToETIMS called', { invoiceData });
    
    if (!unifiedServiceRef.current) throw new Error('Unified service not initialized');

    try {
      setError(null);
      console.log(`🔄 Submitting to eTIMS in ${currentMode} mode`);
      
      const result = await unifiedServiceRef.current.submitToETIMS(invoiceData);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      console.log(`✅ eTIMS submission successful in ${currentMode} mode`);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit to eTIMS';
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error submitting to eTIMS:', err);
      throw err;
    }
  }, [currentMode]);

  const getSalesReport = useCallback(async (startDate: Date, endDate: Date) => {
    console.log('🔄 useUnifiedSales: getSalesReport called', { startDate, endDate });
    
    if (!unifiedServiceRef.current) throw new Error('Unified service not initialized');

    try {
      setError(null);
      console.log(`🔄 Getting sales report in ${currentMode} mode`);
      
      const result = await unifiedServiceRef.current.getSalesReport(storeId, startDate, endDate);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get sales report';
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error getting sales report:', err);
      throw err;
    }
  }, [storeId, currentMode]);

  const getAllSalesReport = useCallback(async (startDate: Date, endDate: Date) => {
    console.log('🔄 useUnifiedSales: getAllSalesReport called', { startDate, endDate });
    
    if (!unifiedServiceRef.current) throw new Error('Unified service not initialized');

    try {
      setError(null);
      console.log(`🔄 Getting all sales report in ${currentMode} mode`);
      
      const result = await unifiedServiceRef.current.getAllSalesReport(storeId, startDate, endDate);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get all sales report';
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error getting all sales report:', err);
      throw err;
    }
  }, [storeId, currentMode]);

  // Initial fetch - only run once when storeId and user are available
  useEffect(() => {
    console.log('🔄 useUnifiedSales: Initial fetch useEffect running', { 
      storeId, 
      hasUser: !!user, 
      isInitialized: isInitialized.current 
    });
    
    if (storeId && user && !isInitialized.current) {
      console.log('🔄 useUnifiedSales: Initializing and fetching transactions');
      isInitialized.current = true;
      fetchTransactions();
    }
  }, [storeId, user]); // Removed fetchTransactions from dependencies

  console.log('🔄 useUnifiedSales: Returning hook result');
  
  return {
    transactions,
    isLoading,
    error,
    currentMode,
    syncStatus,
    createSale,
    fetchTransactions,
    submitToETIMS,
    getSalesReport,
    getAllSalesReport,
    // Mode-specific utilities
    isOnlineMode: unifiedServiceRef.current?.isOnlineMode() || false,
    isOfflineMode: unifiedServiceRef.current?.isOfflineMode() || false,
    getPendingSyncCount: unifiedServiceRef.current?.getPendingSyncCount.bind(unifiedServiceRef.current) || (() => Promise.resolve(0)),
    syncPendingData: unifiedServiceRef.current?.syncPendingData.bind(unifiedServiceRef.current) || (() => Promise.resolve())
  };
} 