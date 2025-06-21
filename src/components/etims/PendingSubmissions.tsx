import { useEffect, useState } from 'react';
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';

export function PendingSubmissions() {
  const { user } = useSimplifiedAuth();
  const { currentMode, getPendingETIMSSubmissions, syncPendingETIMSSubmissions } = useUnifiedService();
  const [pendingSubmissions, setPendingSubmissions] = useState<Record<string, unknown>[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const loadPendingSubmissions = async () => {
    if (!user?.user_metadata?.store_id) return;
    
    try {
      const submissions = await getPendingETIMSSubmissions(user.user_metadata.store_id);
      setPendingSubmissions(submissions);
    } catch (err) {
      console.error('Error loading pending submissions:', err);
      setError('Failed to load pending submissions');
    }
  };

  useEffect(() => {
    loadPendingSubmissions();
  }, [user, currentMode]); // Reload when user or mode changes

  const handleSync = async () => {
    if (!user?.user_metadata?.store_id) return;
    
    try {
      setIsSyncing(true);
      setError(null);
      
      const result = await syncPendingETIMSSubmissions(user.user_metadata.store_id);
      
      if (result.success) {
        setLastSyncTime(new Date());
        await loadPendingSubmissions(); // Reload after sync
      } else {
        setError(result.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Error syncing ETIMS submissions:', err);
      setError('Failed to sync submissions');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="p-4 bg-[#2D3748] border-none">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Pending eTIMS Submissions</h2>
          <p className="text-sm text-gray-300">Mode: {currentMode}</p>
        </div>
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
            Syncing ETIMS submissions...
          </p>
        </div>
      )}

      {lastSyncTime && (
        <p className="text-sm text-gray-300 mb-4">
          Last synced: {lastSyncTime.toLocaleString()}
        </p>
      )}

      <div className="space-y-2">
        {pendingSubmissions.length === 0 ? (
          <p className="text-sm text-gray-300">No pending submissions</p>
        ) : (
          pendingSubmissions.map((submission) => (
            <div 
              key={submission.id as string} 
              className="flex justify-between items-center p-2 bg-[#1A1F36] rounded-md"
            >
              <div>
                <p className="font-medium text-white">{submission.invoice_number as string}</p>
                <p className="text-sm text-gray-300">
                  {new Date(submission.submitted_at as string).toLocaleString()}
                </p>
              </div>
              <p className="text-sm font-medium text-white">
                KES {(submission.data as any)?.total_amount?.toFixed(2) || '0.00'}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
} 