import { useEffect, useState } from 'react';
import { getPendingSuppliers, db } from '@/lib/db';
import { Database } from '@/types/supabase';
import { createClient } from '@/lib/supabase-clients/pages';

export interface SupplierSyncStatus {
  isSyncing: boolean;
  currentItem: number;
  totalItems: number;
  lastSyncTime: Date | null;
  error: string | null;
}

let globalSupplierSyncStatus: SupplierSyncStatus = {
  isSyncing: false,
  currentItem: 0,
  totalItems: 0,
  lastSyncTime: null,
  error: null
};

export const getSupplierSyncStatus = () => globalSupplierSyncStatus;

export const triggerSupplierSync = async () => {
  if (globalSupplierSyncStatus.isSyncing) return;
  globalSupplierSyncStatus = { ...globalSupplierSyncStatus, isSyncing: true, error: null };
  const supabase = createClient();
  try {
    const pendingSuppliers = await getPendingSuppliers();
    globalSupplierSyncStatus = { ...globalSupplierSyncStatus, totalItems: pendingSuppliers.length };
    for (let i = 0; i < pendingSuppliers.length; i++) {
      const supplier = pendingSuppliers[i];
      globalSupplierSyncStatus = { ...globalSupplierSyncStatus, currentItem: i + 1 };
      try {
        // Check if supplier already exists in Supabase by VAT or name
        let exists = false;
        let supabaseSupplierId = null;
        if (supplier.vat_no) {
          const { data: vatMatch } = await supabase
            .from('suppliers')
            .select('id')
            .eq('vat_no', supplier.vat_no)
            .maybeSingle();
          exists = !!vatMatch;
          if (vatMatch) supabaseSupplierId = vatMatch.id;
        }
        if (!exists) {
          const { data: nameMatch } = await supabase
            .from('suppliers')
            .select('id')
            .eq('name', supplier.name)
            .maybeSingle();
          exists = !!nameMatch;
          if (nameMatch) supabaseSupplierId = nameMatch.id;
        }
        if (!exists) {
          // Insert supplier
          const { data, error } = await supabase.from('suppliers').insert({
            name: supplier.name,
            vat_no: supplier.vat_no,
            contact_info: supplier.contact_info,
            created_at: supplier.created_at
          }).select('id').maybeSingle();
          if (error) throw error;
          supabaseSupplierId = data?.id;
        }
        // Mark as synced locally
        await db.suppliers.update(supplier.id, { synced: true });
        // Update all local purchases that reference this supplier to use the Supabase supplier ID
        if (supabaseSupplierId) {
          await db.purchases.where('supplier_id').equals(supplier.id).modify({ supplier_id: supabaseSupplierId });
        }
      } catch (err) {
        globalSupplierSyncStatus = { ...globalSupplierSyncStatus, error: String(err) };
        break;
      }
    }
    globalSupplierSyncStatus = { ...globalSupplierSyncStatus, isSyncing: false, lastSyncTime: new Date(), currentItem: 0, totalItems: 0 };
  } catch (err) {
    globalSupplierSyncStatus = { ...globalSupplierSyncStatus, isSyncing: false, error: String(err) };
  }
};

export function useGlobalSupplierSync() {
  const [syncStatus, setSyncStatus] = useState<SupplierSyncStatus>(globalSupplierSyncStatus);
  useEffect(() => {
    setSyncStatus(globalSupplierSyncStatus);
    let interval: NodeJS.Timeout;
    const doSync = async () => {
      await triggerSupplierSync();
      setSyncStatus({ ...globalSupplierSyncStatus });
    };
    doSync();
    interval = setInterval(doSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return syncStatus;
} 