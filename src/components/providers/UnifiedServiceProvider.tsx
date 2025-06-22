'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getUnifiedService } from '@/lib/services/UnifiedService';
import { getModeManager } from '@/lib/mode/ModeManager';
import { Database } from '@/types/supabase';
import { CreateProductInput, SaleInput, PurchaseInput } from '@/lib/services/UnifiedService';

interface AppSettings {
  enable_vat_toggle_on_pos: boolean;
  vat_pricing_model: 'inclusive' | 'exclusive';
  default_vat_rate: number;
  // Receipt settings
  receipt_auto_print?: boolean;
  receipt_auto_download?: boolean;
  receipt_download_format?: 'pdf' | 'txt' | 'both';
  receipt_print_delay?: number;
  receipt_download_delay?: number;
  receipt_show_inline?: boolean;
  receipt_auto_close?: boolean;
  receipt_close_delay?: number;
  // Cost protection settings
  cost_protection_enabled?: boolean;
  cost_protection_admin_approval?: boolean;
  cost_protection_allow_below_cost?: boolean;
  cost_protection_min_margin?: number;
  cost_protection_show_warnings?: boolean;
  cost_protection_auto_calculate?: boolean;
}

interface UnifiedServiceContextType {
  currentMode: 'offline' | 'online';
  isOnlineMode: boolean;
  isOfflineMode: boolean;
  getProducts: (storeId: string) => Promise<Database['public']['Tables']['products']['Row'][]>;
  createProduct: (productData: CreateProductInput) => Promise<Database['public']['Tables']['products']['Row']>;
  updateProduct: (productId: string, updates: Partial<Database['public']['Tables']['products']['Update']>) => Promise<Database['public']['Tables']['products']['Row']>;
  updateStock: (productId: string, quantityChange: number, version?: number) => Promise<Database['public']['Tables']['products']['Row']>;
  getTransactions: (storeId: string, startDate?: Date, endDate?: Date) => Promise<Database['public']['Tables']['transactions']['Row'][]>;
  createSale: (saleData: SaleInput) => Promise<Database['public']['Tables']['transactions']['Row']>;
  getPurchases: (storeId: string, startDate?: Date, endDate?: Date) => Promise<Array<Database['public']['Tables']['purchases']['Row'] & { items: Database['public']['Tables']['purchase_items']['Row'][]; supplier_name?: string }>>;
  createPurchase: (purchaseData: PurchaseInput) => Promise<Database['public']['Tables']['purchases']['Row'] & { items: Database['public']['Tables']['purchase_items']['Row'][] }>;
  submitToETIMS: (invoiceData: Record<string, unknown>) => Promise<Record<string, unknown>>;
  getPendingETIMSSubmissions: (storeId: string) => Promise<Record<string, unknown>[]>;
  syncPendingETIMSSubmissions: (storeId: string) => Promise<{ success: boolean; error?: string }>;
  getPendingSyncCount: () => Promise<number>;
  syncPendingData: () => Promise<void>;
  clearOfflineData: () => Promise<void>;
  // Report methods
  generateReports: (storeId: string, startDate: Date, endDate: Date) => Promise<unknown[]>;
  generateInventoryReport: (storeId: string) => Promise<unknown[]>;
  generateInputVatReport: (storeId: string, startDate: Date, endDate: Date) => Promise<unknown[]>;
  generalReport: (storeId: string, startDate: Date, endDate: Date) => Promise<unknown[]>;
  getAppSettings: () => Promise<AppSettings>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

const UnifiedServiceContext = createContext<UnifiedServiceContextType | null>(null);

export function UnifiedServiceProvider({ children }: { children: React.ReactNode }) {
  // Initialize service and mode manager synchronously to avoid the "not initialized" error
  const modeManager = getModeManager();
  const unifiedService = getUnifiedService(modeManager);
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>(modeManager.getCurrentMode());

  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      setCurrentMode(newMode);
      console.log(`🔄 UnifiedServiceProvider: Mode changed to ${newMode}`);
    };
    
    window.addEventListener('modeChange', handleModeChange as EventListener);
    
    return () => {
      window.removeEventListener('modeChange', handleModeChange as EventListener);
    };
  }, []);

  const contextValue: UnifiedServiceContextType = {
    currentMode,
    isOnlineMode: currentMode === 'online',
    isOfflineMode: currentMode === 'offline',
    getProducts: async (storeId: string) => {
      return await unifiedService.getProducts(storeId);
    },
    createProduct: async (productData: CreateProductInput) => {
      return await unifiedService.createProduct(productData);
    },
    updateProduct: async (productId: string, updates: Partial<Database['public']['Tables']['products']['Update']>) => {
      return await unifiedService.updateProduct(productId, updates);
    },
    updateStock: async (productId: string, quantityChange: number, version?: number) => {
      return await unifiedService.updateStock(productId, quantityChange, version);
    },
    getTransactions: async (storeId: string, startDate?: Date, endDate?: Date) => {
      return await unifiedService.getTransactions(storeId, startDate, endDate);
    },
    createSale: async (saleData: SaleInput) => {
      return await unifiedService.createSale(saleData);
    },
    getPurchases: async (storeId: string, startDate?: Date, endDate?: Date) => {
      return await unifiedService.getPurchases(storeId, startDate, endDate);
    },
    createPurchase: async (purchaseData: PurchaseInput) => {
      return await unifiedService.createPurchase(purchaseData);
    },
    submitToETIMS: async (invoiceData: Record<string, unknown>) => {
      return await unifiedService.submitToETIMS(invoiceData);
    },
    getPendingETIMSSubmissions: async (storeId: string) => {
      return await unifiedService.getPendingETIMSSubmissions(storeId);
    },
    syncPendingETIMSSubmissions: async (storeId: string) => {
      return await unifiedService.syncPendingETIMSSubmissions(storeId);
    },
    getPendingSyncCount: async () => {
      return await unifiedService.getPendingSyncCount();
    },
    syncPendingData: async () => {
      return await unifiedService.syncPendingData();
    },
    clearOfflineData: async () => {
      return await unifiedService.clearOfflineData();
    },
    generateReports: async (storeId: string, startDate: Date, endDate: Date) => {
      return await unifiedService.generateReports(storeId, startDate, endDate);
    },
    generateInventoryReport: async (storeId: string) => {
      return await unifiedService.generateInventoryReport(storeId);
    },
    generateInputVatReport: async (storeId: string, startDate: Date, endDate: Date) => {
      return await unifiedService.generateInputVatReport(storeId, startDate, endDate);
    },
    generalReport: async (storeId: string, startDate: Date, endDate: Date) => {
      return await unifiedService.generalReport(storeId, startDate, endDate);
    },
    getAppSettings: async () => {
      return await unifiedService.getAppSettings();
    },
    updateAppSettings: async (settings: Partial<AppSettings>) => {
      return await unifiedService.updateAppSettings(settings);
    },
  };

  return (
    <UnifiedServiceContext.Provider value={contextValue}>
      {children}
    </UnifiedServiceContext.Provider>
  );
}

export function useUnifiedService() {
  const context = useContext(UnifiedServiceContext);
  if (!context) {
    throw new Error('useUnifiedService must be used within a UnifiedServiceProvider');
  }
  return context;
} 