import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase-clients/pages';
import { getPendingETIMSSubmissions } from '@/lib/db';
import { useState, useEffect, useRef, useCallback } from 'react';
import { EtimsInvoice } from '@/lib/etims/utils';
import { markEtimsSubmissionAsSynced } from '@/lib/etims/utils';

interface SyncStatus {
  isSyncing: boolean;
  error: string | null;
  lastSyncTime: Date | null;
  currentItem: number;
  totalItems: number;
}

// Create a module-level variable to store the sync status
let globalEtimsSyncStatus: SyncStatus = {
  isSyncing: false,
  error: null,
  lastSyncTime: null,
  currentItem: 0,
  totalItems: 0
};

// Function to get the current sync status
export const getEtimsSyncStatus = () => globalEtimsSyncStatus;

export function useGlobalEtimsSync() {
  const { user, isOnline } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    error: null,
    lastSyncTime: null,
    currentItem: 0,
    totalItems: 0
  });
  const syncInProgress = useRef(false);

  const triggerManualSync = useCallback(async () => {
    if (!user || !isOnline || syncInProgress.current) {
      return;
    }
    await syncEtims();
  }, [user, isOnline]);

  const syncEtims = async () => {
    if (!user || !isOnline || syncInProgress.current) {
      return;
    }

    try {
      console.log('🔒 Acquiring eTIMS sync lock');
      syncInProgress.current = true;
      setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));
      globalEtimsSyncStatus = { ...syncStatus, isSyncing: true, error: null };

      // Get all pending eTIMS submissions
      const pendingSubmissions = await getPendingETIMSSubmissions(user.user_metadata.store_id);

      console.log('📊 Found pending eTIMS submissions:', {
        count: pendingSubmissions.length,
        submissions: pendingSubmissions.map(s => ({
          invoice_number: s.invoice_number,
          status: s.status
        }))
      });

      setSyncStatus(prev => ({ ...prev, totalItems: pendingSubmissions.length }));
      globalEtimsSyncStatus = { ...syncStatus, totalItems: pendingSubmissions.length };

      for (const [index, submission] of pendingSubmissions.entries()) {
        try {
          setSyncStatus(prev => ({ ...prev, currentItem: index + 1 }));
          globalEtimsSyncStatus = { ...syncStatus, currentItem: index + 1 };

          console.log('🔄 Processing eTIMS submission:', {
            index: index + 1,
            total: pendingSubmissions.length,
            invoice_number: submission.invoice_number,
            store_id: submission.store_id
          });

          // Validate submission data before sending
          if (!submission.response_data) {
            throw new Error('Missing response data in submission');
          }

          const invoiceData = submission.response_data as unknown as EtimsInvoice;
          if (!invoiceData.invoice_number || !invoiceData.store_id) {
            throw new Error('Invalid invoice data format');
          }

          console.log('📤 Preparing eTIMS submission request:', {
            invoice_number: submission.invoice_number,
            store_id: submission.store_id,
            invoice_data: {
              ...invoiceData,
              invoice_number: submission.invoice_number,
              store_id: submission.store_id
            }
          });

          const response = await fetch('/api/etims/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              invoiceData: {
                ...invoiceData,
                invoice_number: submission.invoice_number,
                store_id: submission.store_id
              },
              store_id: submission.store_id 
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            // Check if it's a rate limit error
            const isRateLimit = errorData.error?.includes('rateLimitExceeded') || 
                              errorData.error?.includes('rate limits') ||
                              errorData.error?.includes('PERMISSION_DENIED');

            if (isRateLimit) {
              console.warn('⚠️ Rate limit hit, will retry in next sync cycle:', {
                invoice_number: submission.invoice_number,
                error: errorData.error
              });
              // Don't mark as failed, let it retry in the next cycle
              continue;
            }

            console.error('❌ Error syncing eTIMS submission:', {
              invoice_number: submission.invoice_number,
              error: errorData.error || 'Unknown error',
              response: errorData
            });
            throw new Error(errorData.error || 'Failed to submit invoice');
          }

          const data = await response.json();

          // Mark as synced after successful submission
          await markEtimsSubmissionAsSynced(submission.id!);
          console.log('✅ Successfully synced eTIMS submission:', {
            invoice_number: submission.invoice_number,
            store_id: submission.store_id,
            response: data
          });

        } catch (error) {
          console.error('❌ Error processing eTIMS submission:', {
            invoice_number: submission.invoice_number,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          setSyncStatus(prev => ({ 
            ...prev, 
            error: `Failed to sync eTIMS submission ${index + 1}`
          }));
          globalEtimsSyncStatus = { ...syncStatus, error: `Failed to sync eTIMS submission ${index + 1}` };
        }
      }

      console.log('✅ eTIMS sync cycle completed:', {
        lastSyncTime: new Date(),
        totalSubmissionsProcessed: pendingSubmissions.length,
        successfulSubmissions: pendingSubmissions.length - (globalEtimsSyncStatus.error ? 1 : 0)
      });

      setSyncStatus(prev => ({ 
        ...prev, 
        isSyncing: false, 
        lastSyncTime: new Date(),
        currentItem: 0,
        totalItems: 0
      }));
      globalEtimsSyncStatus = { 
        ...syncStatus, 
        isSyncing: false, 
        lastSyncTime: new Date(),
        currentItem: 0,
        totalItems: 0
      };

    } catch (err) {
      console.error('❌ Error in eTIMS sync process:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setSyncStatus(prev => ({ 
        ...prev, 
        isSyncing: false, 
        error: 'Failed to process eTIMS sync queue'
      }));
      globalEtimsSyncStatus = { 
        ...syncStatus, 
        isSyncing: false, 
        error: 'Failed to process eTIMS sync queue'
      };
    } finally {
      syncInProgress.current = false;
      console.log('🔓 Releasing eTIMS sync lock');
    }
  };

  useEffect(() => {
    const syncInterval = setInterval(syncEtims, 5 * 60 * 1000); // Every 5 minutes
    console.log('⏰ Setting up eTIMS sync interval');

    // Initial sync
    syncEtims();

    return () => {
      clearInterval(syncInterval);
    };
  }, [user, isOnline]);

  return {
    syncStatus,
    isSyncing: syncStatus.isSyncing,
    error: syncStatus.error,
    lastSyncTime: syncStatus.lastSyncTime,
    currentItem: syncStatus.currentItem,
    totalItems: syncStatus.totalItems,
    triggerManualSync
  };
} 