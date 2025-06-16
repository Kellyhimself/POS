import { useEffect, useState } from 'react';
import { useGlobalEtimsSync } from '@/lib/hooks/useGlobalEtimsSync';
import { getPendingEtimsSubmissions } from '@/lib/etims/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function PendingSubmissions() {
  const { isSyncing, currentItem, totalItems, lastSyncTime, error, triggerManualSync } = useGlobalEtimsSync();
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);

  const loadPendingSubmissions = async () => {
    const submissions = await getPendingEtimsSubmissions();
    setPendingSubmissions(submissions);
  };

  useEffect(() => {
    loadPendingSubmissions();
  }, [isSyncing]); // Reload when sync status changes

  const handleSync = async () => {
    await triggerManualSync();
    await loadPendingSubmissions();
  };

  return (
    <Card className="p-4 bg-[#2D3748] border-none">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Pending eTIMS Submissions</h2>
        <Button 
          onClick={handleSync} 
          disabled={isSyncing}
          variant="outline"
          className="flex items-center gap-2 text-white border-white/20 hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isSyncing && (
        <div className="mb-4">
          <p className="text-sm text-gray-300">
            Syncing submission {currentItem} of {totalItems}
          </p>
        </div>
      )}

      {lastSyncTime && (
        <p className="text-sm text-gray-300 mb-4">
          Last synced: {new Date(lastSyncTime).toLocaleString()}
        </p>
      )}

      <div className="space-y-2">
        {pendingSubmissions.length === 0 ? (
          <p className="text-sm text-gray-300">No pending submissions</p>
        ) : (
          pendingSubmissions.map((submission) => (
            <div 
              key={submission.id} 
              className="flex justify-between items-center p-2 bg-[#1A1F36] rounded-md"
            >
              <div>
                <p className="font-medium text-white">{submission.invoice_number}</p>
                <p className="text-sm text-gray-300">
                  {new Date(submission.submitted_at).toLocaleString()}
                </p>
              </div>
              <p className="text-sm font-medium text-white">
                KES {submission.data?.total_amount?.toFixed(2) || '0.00'}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
} 