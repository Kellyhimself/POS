import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
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
  const { user } = useAuth();
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

  const modeManager = getModeManager();
  const unifiedService = getUnifiedService(modeManager);

  // Listen for mode changes
  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      setCurrentMode(newMode);
      setSyncStatus(prev => ({ ...prev, currentMode: newMode }));
      console.log(`🔄 Sales hook: Mode changed to ${newMode}`);
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
      console.log('🔄 Setting up real-time transaction subscriptions');
      
      const channel = unifiedService.subscribeToTransactions(storeId, (payload) => {
        console.log('🔄 Real-time transaction update:', payload);
        handleTransactionChange(payload);
      });

      return () => {
        if (channel) {
          console.log('🔄 Cleaning up real-time transaction subscriptions');
          // Note: Supabase channel cleanup is handled automatically
        }
      };
    }
  }, [currentMode, storeId, unifiedService]);

  const handleTransactionChange = useCallback((payload: any) => {
    setTransactions(prevTransactions => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
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

  const fetchTransactions = useCallback(async (startDate?: Date, endDate?: Date) => {
    if (!storeId) return;

    try {
      setIsLoading(true);
      setError(null);
      console.log(`🔄 Fetching transactions in ${currentMode} mode`);
      
      const data = await unifiedService.getTransactions(storeId, startDate, endDate);
      setTransactions(data);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        error: null
      }));
      
      console.log(`✅ Fetched ${data.length} transactions in ${currentMode} mode`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch transactions';
      setError(errorMessage);
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage
      }));
      console.error('❌ Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, currentMode, unifiedService]);

  const createSale = useCallback(async (saleData: CreateSaleInput): Promise<Database['public']['Tables']['transactions']['Row']> => {
    try {
      setError(null);
      console.log(`🔄 Creating sale in ${currentMode} mode`);
      
      const result = await unifiedService.createSale(saleData);
      
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
  }, [currentMode, unifiedService]);

  const submitToETIMS = useCallback(async (invoiceData: any) => {
    try {
      setError(null);
      console.log(`🔄 Submitting to eTIMS in ${currentMode} mode`);
      
      const result = await unifiedService.submitToETIMS(invoiceData);
      
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
  }, [currentMode, unifiedService]);

  const getSalesReport = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      setError(null);
      console.log(`🔄 Getting sales report in ${currentMode} mode`);
      
      const result = await unifiedService.getSalesReport(storeId, startDate, endDate);
      
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
  }, [storeId, currentMode, unifiedService]);

  const getAllSalesReport = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      setError(null);
      console.log(`🔄 Getting all sales report in ${currentMode} mode`);
      
      const result = await unifiedService.getAllSalesReport(storeId, startDate, endDate);
      
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
  }, [storeId, currentMode, unifiedService]);

  // Initial fetch
  useEffect(() => {
    if (storeId && user) {
      fetchTransactions();
    }
  }, [storeId, user, fetchTransactions]);

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
    isOnlineMode: unifiedService.isOnlineMode(),
    isOfflineMode: unifiedService.isOfflineMode(),
    getPendingSyncCount: unifiedService.getPendingSyncCount.bind(unifiedService),
    syncPendingData: unifiedService.syncPendingData.bind(unifiedService)
  };
} 