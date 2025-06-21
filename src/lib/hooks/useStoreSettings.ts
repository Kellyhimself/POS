import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase-clients/pages';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';

// Create a single instance of the client
const supabase = createClient();

export interface StoreSettings {
  id: string;
  store_id: string;
  low_stock_threshold: number;
  enable_offline_mode: boolean;
  enable_vat: boolean;
  vat_rate: number;
  enable_etims: boolean;
  enable_mpesa: boolean;
  mpesa_paybill: string | null;
  mpesa_till_number: string | null;
  enable_notifications: boolean;
  enable_auto_sync: boolean;
  sync_interval: number;
  created_at: string;
  updated_at: string;
}

export function useStoreSettings() {
  const { user } = useSimplifiedAuth();
  const queryClient = useQueryClient();
  const storeId = user?.user_metadata?.store_id;

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['storeSettings', storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No store ID found');

      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('store_id', storeId)
        .single();

      if (error) throw error;
      return data as StoreSettings;
    },
    enabled: !!storeId,
  });

  const { mutate: updateSettings, isPending: isUpdating } = useMutation({
    mutationFn: async (newSettings: Partial<StoreSettings>) => {
      if (!storeId) throw new Error('No store ID found');

      const { data, error } = await supabase
        .from('store_settings')
        .upsert({
          store_id: storeId,
          ...newSettings,
        })
        .select()
        .single();

      if (error) throw error;
      return data as StoreSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['storeSettings', storeId], data);
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    isUpdating,
  };
} 