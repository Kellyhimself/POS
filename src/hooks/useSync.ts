import { useEffect, useState } from 'react';
import { syncService } from '@/lib/sync';
import { Database } from '@/types/supabase';

type Product = Database['public']['Tables']['products']['Row'];
type Sale = Database['public']['Tables']['transactions']['Row'];

export function useSync(store_id: string) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const sync = async () => {
    if (!isOnline) return;
    
    setIsSyncing(true);
    try {
      await syncService.initialSync(store_id);
      setLastSynced(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const saveSale = async (sale: Omit<Sale, 'id' | 'timestamp' | 'synced'>) => {
    try {
      const result = await syncService.saveSale(sale);
      if (isOnline) {
        setLastSynced(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error saving sale:', error);
      throw error;
    }
  };

  const updateStock = async (product_id: string, quantity_change: number) => {
    try {
      const result = await syncService.updateStock({
        product_id,
        store_id,
        quantity_change
      });
      if (isOnline) {
        setLastSynced(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  };

  const submitToETIMS = async (invoice_number: string, data: any) => {
    try {
      const result = await syncService.submitToETIMS({
        store_id,
        invoice_number,
        data
      });
      if (isOnline) {
        setLastSynced(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error submitting to eTIMS:', error);
      throw error;
    }
  };

  const getProducts = async () => {
    try {
      return await syncService.getProducts(store_id);
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  };

  const generateReports = async (startDate: Date, endDate: Date) => {
    try {
      return await syncService.generateReports(store_id, startDate, endDate);
    } catch (error) {
      console.error('Error generating reports:', error);
      throw error;
    }
  };

  return {
    isOnline,
    isSyncing,
    lastSynced,
    sync,
    saveSale,
    updateStock,
    submitToETIMS,
    getProducts,
    generateReports
  };
} 