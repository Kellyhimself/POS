import { useEffect, useState } from 'react';
import { getPendingPurchases, markPurchaseAsSynced, db } from '@/lib/db';
import { syncService } from '@/lib/sync';
import type { Database } from '@/types/supabase';

export interface PurchaseSyncStatus {
  isSyncing: boolean;
  currentItem: number;
  totalItems: number;
  lastSyncTime: Date | null;
  error: string | null;
}

let globalPurchaseSyncStatus: PurchaseSyncStatus = {
  isSyncing: false,
  currentItem: 0,
  totalItems: 0,
  lastSyncTime: null,
  error: null
};

export const getPurchaseSyncStatus = () => globalPurchaseSyncStatus;

export const triggerPurchaseSync = async () => {
  if (globalPurchaseSyncStatus.isSyncing) return;
  globalPurchaseSyncStatus = { ...globalPurchaseSyncStatus, isSyncing: true, error: null };
  try {
    // Check if all suppliers are synced before syncing purchases
    const unsyncedSuppliers = await db.suppliers.filter(supplier => supplier.synced === false).toArray();
    if (unsyncedSuppliers.length > 0) {
      globalPurchaseSyncStatus = {
        ...globalPurchaseSyncStatus,
        isSyncing: false,
        error: 'Cannot sync purchases: not all suppliers are synced yet.'
      };
      return;
    }
    const pendingPurchases = await getPendingPurchases();
    globalPurchaseSyncStatus = { ...globalPurchaseSyncStatus, totalItems: pendingPurchases.length };
    for (let i = 0; i < pendingPurchases.length; i++) {
      let purchase = pendingPurchases[i];
      globalPurchaseSyncStatus = { ...globalPurchaseSyncStatus, currentItem: i + 1 };
      // Remove supplier name if present
      if ('supplier_name' in purchase) {
        const { supplier_name, ...rest } = purchase;
        purchase = rest;
      }
      // If purchase has a supplier_id, check if it exists in Supabase (skip if not)
      if (purchase.supplier_id) {
        // Assume Supabase IDs are UUIDs (36 chars, with dashes)
        if (typeof purchase.supplier_id !== 'string' || purchase.supplier_id.length !== 36 || !purchase.supplier_id.includes('-')) {
          // Not a valid Supabase ID, skip syncing this purchase
          continue;
        }
      }
      // Get items for this purchase
      const items = await db.purchase_items.where('purchase_id').equals(purchase.id).toArray();
      // Upload to Supabase
      try {
        await syncService.createPurchase(purchase, items);
        await markPurchaseAsSynced(purchase.id);
        // Update sync status state immediately after local update
        setSyncStatus({ ...globalPurchaseSyncStatus });
      } catch (err) {
        globalPurchaseSyncStatus = { ...globalPurchaseSyncStatus, error: String(err) };
        setSyncStatus({ ...globalPurchaseSyncStatus });
        break;
      }
    }
    globalPurchaseSyncStatus = { ...globalPurchaseSyncStatus, isSyncing: false, lastSyncTime: new Date(), currentItem: 0, totalItems: 0 };
  } catch (err) {
    globalPurchaseSyncStatus = { ...globalPurchaseSyncStatus, isSyncing: false, error: String(err) };
  }
};

export function useGlobalPurchaseSync() {
  const [syncStatus, setSyncStatus] = useState<PurchaseSyncStatus>(globalPurchaseSyncStatus);
  useEffect(() => {
    setSyncStatus(globalPurchaseSyncStatus);
    let interval: NodeJS.Timeout;
    const doSync = async () => {
      await triggerPurchaseSync();
      setSyncStatus({ ...globalPurchaseSyncStatus });
    };
    doSync();
    interval = setInterval(doSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return syncStatus;
} 