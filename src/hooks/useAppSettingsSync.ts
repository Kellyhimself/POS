import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase-clients/pages';
import { cacheAppSettings, getCachedAppSettings } from '@/lib/db';

interface AppSettings {
  id: string;
  enable_vat_toggle_on_pos: boolean;
  vat_pricing_model: 'inclusive' | 'exclusive';
  default_vat_rate: number;
  enable_etims_integration: boolean;
  synced: boolean;
  updated_at: string;
}

export function useAppSettingsSync() {
  const { isOnline: authIsOnline } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const supabase = createClient();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 Network is online (navigator.onLine)');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('🔴 Network is offline (navigator.onLine)');
      setIsOnline(false);
    };

    // Set initial state
    setIsOnline(navigator.onLine);
    console.log('🌐 Initial network status:', navigator.onLine ? 'Online' : 'Offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Log when auth online status changes
  useEffect(() => {
    console.log('🔐 Auth online status:', authIsOnline ? 'Online' : 'Offline');
  }, [authIsOnline]);

  // Sync settings when coming online
  useEffect(() => {
    const handleOnline = async () => {
      if (isOnline) {
        console.log('🟢 Network is online, syncing settings...');
        await syncSettings();
        setLastSynced(new Date());
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isOnline]);

  // Initial load of settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      console.log('📥 Loading settings...');
      console.log('🌐 Network status:', isOnline ? 'Online' : 'Offline');
      console.log('🔐 Auth status:', authIsOnline ? 'Online' : 'Offline');
      
      // First try to get from IndexedDB
      const localSettings = await getCachedAppSettings();
      console.log('💾 Cached settings:', localSettings);
      
      if (localSettings) {
        // If we have local settings and we're offline, use them
        if (!isOnline) {
          console.log('📱 Using cached settings (offline mode)');
          return localSettings;
        }

        // If online, try to get from Supabase
        try {
          console.log('🔄 Fetching settings from Supabase...');
          const { data: supabaseSettings, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 'global')
            .single();

          if (error) throw error;

          if (supabaseSettings) {
            console.log('✅ Retrieved settings from Supabase:', supabaseSettings);
            // Update local cache with Supabase data
            const updatedSettings = {
              id: 'global',
              enable_vat_toggle_on_pos: supabaseSettings.enable_vat_toggle_on_pos,
              vat_pricing_model: supabaseSettings.vat_pricing_model,
              default_vat_rate: supabaseSettings.default_vat_rate,
              enable_etims_integration: supabaseSettings.enable_etims_integration,
              synced: true,
              updated_at: supabaseSettings.updated_at
            };
            console.log('💾 Caching updated settings from Supabase');
            await cacheAppSettings(updatedSettings);
            setLastSynced(new Date());
            return updatedSettings;
          }
        } catch (error) {
          console.error('❌ Error fetching from Supabase:', error);
          console.log('📱 Falling back to cached settings due to Supabase error');
          return localSettings;
        }
      }

      // If no local settings and we're online, try Supabase
      if (isOnline) {
        console.log('🔄 No cached settings found, fetching from Supabase...');
        const { data: supabaseSettings, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 'global')
          .single();

        if (error) throw error;

        if (supabaseSettings) {
          console.log('✅ Retrieved settings from Supabase:', supabaseSettings);
          const settings = {
            id: 'global',
            enable_vat_toggle_on_pos: supabaseSettings.enable_vat_toggle_on_pos,
            vat_pricing_model: supabaseSettings.vat_pricing_model,
            default_vat_rate: supabaseSettings.default_vat_rate,
            enable_etims_integration: supabaseSettings.enable_etims_integration,
            synced: true,
            updated_at: supabaseSettings.updated_at
          };
          console.log('💾 Caching settings from Supabase');
          await cacheAppSettings(settings);
          setLastSynced(new Date());
          return settings;
        }
      }

      // If all else fails, return default settings
      console.log('⚠️ No settings found, using defaults');
      const defaultSettings = {
        id: 'global',
        enable_vat_toggle_on_pos: true,
        vat_pricing_model: 'exclusive' as const,
        default_vat_rate: 16,
        enable_etims_integration: false,
        synced: false,
        updated_at: new Date().toISOString()
      };
      console.log('💾 Caching default settings');
      await cacheAppSettings(defaultSettings);
      return defaultSettings;
    } catch (error) {
      console.error('❌ Error loading app settings:', error);
      throw error;
    }
  };

  const syncSettings = async () => {
    if (!isOnline) {
      console.log('📱 Skipping sync - offline mode');
      return;
    }

    setIsSyncing(true);
    try {
      console.log('🔄 Starting settings sync...');
      const localSettings = await getCachedAppSettings();
      console.log('💾 Current cached settings:', localSettings);
      
      if (localSettings && !localSettings.synced) {
        console.log('📤 Pushing local changes to Supabase...');
        // Push local changes to Supabase
        const { error } = await supabase
          .from('app_settings')
          .upsert({
            id: 'global',
            enable_vat_toggle_on_pos: localSettings.enable_vat_toggle_on_pos,
            vat_pricing_model: localSettings.vat_pricing_model,
            default_vat_rate: localSettings.default_vat_rate,
            enable_etims_integration: localSettings.enable_etims_integration,
            updated_at: localSettings.updated_at
          });

        if (error) throw error;

        // Mark as synced in IndexedDB
        console.log('💾 Marking settings as synced in cache');
        await cacheAppSettings({
          ...localSettings,
          synced: true
        });
      }

      // Get latest from Supabase
      console.log('📥 Fetching latest settings from Supabase...');
      const { data: supabaseSettings, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'global')
        .single();

      if (error) throw error;

      if (supabaseSettings) {
        console.log('✅ Retrieved latest settings from Supabase:', supabaseSettings);
        // Update local cache if Supabase has newer data
        const localSettings = await getCachedAppSettings();
        if (!localSettings || new Date(supabaseSettings.updated_at) > new Date(localSettings.updated_at)) {
          console.log('💾 Updating cache with newer Supabase settings');
          await cacheAppSettings({
            id: 'global',
            enable_vat_toggle_on_pos: supabaseSettings.enable_vat_toggle_on_pos,
            vat_pricing_model: supabaseSettings.vat_pricing_model,
            default_vat_rate: supabaseSettings.default_vat_rate,
            enable_etims_integration: supabaseSettings.enable_etims_integration,
            synced: true,
            updated_at: supabaseSettings.updated_at
          });
        } else {
          console.log('ℹ️ Cache is up to date with Supabase');
        }
      }

      setLastSynced(new Date());
      console.log('✅ Settings sync completed');
    } catch (error) {
      console.error('❌ Error syncing app settings:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const updateSettings = async (settings: Partial<Omit<AppSettings, 'id' | 'synced' | 'updated_at'>>) => {
    try {
      console.log('📝 Updating settings:', settings);
      const currentSettings = await getCachedAppSettings();
      if (!currentSettings) {
        throw new Error('No current settings found');
      }

      const updatedSettings: AppSettings = {
        ...currentSettings,
        ...settings,
        updated_at: new Date().toISOString(),
        synced: isOnline
      };

      // Save to IndexedDB
      console.log('💾 Caching updated settings');
      await cacheAppSettings(updatedSettings);

      // If online, sync to Supabase
      if (isOnline) {
        console.log('🔄 Syncing updated settings to Supabase');
        await syncSettings();
      } else {
        console.log('📱 Settings updated in cache (offline mode)');
      }

      return updatedSettings;
    } catch (error) {
      console.error('❌ Error updating app settings:', error);
      throw error;
    }
  };

  return {
    isOnline,
    isSyncing,
    lastSynced,
    loadSettings,
    updateSettings,
    syncSettings
  };
} 