'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Download, Upload } from 'lucide-react';
import { getPendingETIMSSubmissions } from '@/lib/db';
import { Database } from '@/types/supabase';
import { SyncFileData, SyncResults, generateSyncFile, validateSyncResults, processSyncResults } from '@/lib/etims/utils';

interface SyncManagerProps {
  storeId: string;
  onResultsUploaded?: (results: SyncResults) => void;
}

type ETIMSSubmission = Database['public']['Tables']['etims_submissions']['Row'];

export default function SyncManager({ storeId, onResultsUploaded }: SyncManagerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<ETIMSSubmission[]>([]);
  const [syncFile, setSyncFile] = useState<SyncFileData | null>(null);

  const loadPendingSubmissions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get pending submissions from IndexedDB
      const submissions = await getPendingETIMSSubmissions(storeId);
      setPendingSubmissions(submissions);
      
      if (!submissions.length) {
        setError('No pending submissions found');
        return;
      }

      // Generate sync file
      const syncData = await generateSyncFile(submissions);
      setSyncFile(syncData);
    } catch (err) {
      console.error('Error loading submissions:', err);
      setError('Failed to load pending submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadSyncFile = async () => {
    if (!syncFile || !pendingSubmissions.length) return;

    try {
      const blob = new Blob([JSON.stringify(syncFile, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etims-sync-${syncFile.session_id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading sync file:', err);
      setError('Failed to download sync file');
    }
  };

  const handleResultsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !syncFile) return;

    try {
      setIsLoading(true);
      setError(null);
      const text = await file.text();
      let results: SyncResults;

      try {
        results = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse results file:', parseError);
        throw new Error('Invalid JSON format in results file');
      }

      // Basic validation
      if (!results || typeof results !== 'object') {
        throw new Error('Invalid results file format');
      }

      if (!results.processed_submissions || !Array.isArray(results.processed_submissions)) {
        console.error('Invalid results structure:', results);
        throw new Error('Results file missing processed_submissions array');
      }

      // Log the results for debugging
      console.log('Processing results file:', {
        session_id: results.session_id,
        store_id: results.store_id,
        submissions_count: results.processed_submissions.length,
        first_submission: results.processed_submissions[0]
      });

      // Validate the results
      const isValid = await validateSyncResults(results, pendingSubmissions);
      if (!isValid) {
        throw new Error('Results file validation failed');
      }

      // Process the results and update the database
      await processSyncResults(results);

      // Call the callback with results
      if (onResultsUploaded) {
        onResultsUploaded(results);
      }

      // Reload pending submissions
      await loadPendingSubmissions();
    } catch (err) {
      console.error('Error processing results file:', err);
      setError(err instanceof Error ? err.message : 'Failed to process results file');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPendingSubmissions();
  }, [storeId]);

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="bg-red-900/50 border-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions Section */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={downloadSyncFile}
          disabled={isLoading || !pendingSubmissions.length}
          className="w-full bg-white text-[#2D3748] hover:bg-gray-100"
          variant="default"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Submissions
        </Button>

        <label className="w-full">
          <Button
            asChild
            disabled={isLoading}
            className="w-full bg-white text-[#2D3748] hover:bg-gray-100"
            variant="default"
          >
            <div className="flex items-center justify-center cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Upload Results
            </div>
          </Button>
          <input
            type="file"
            accept=".json"
            onChange={handleResultsFile}
            className="hidden"
          />
        </label>
      </div>

      {/* Session Info */}
      {syncFile && (
        <div className="bg-[#1A1F36] p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Session ID</p>
              <p className="text-sm font-medium text-white">{syncFile.session_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Submissions</p>
              <p className="text-sm font-medium text-white">{syncFile.submissions.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Submissions List */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white">Pending Submissions</h3>
        {pendingSubmissions.length === 0 ? (
          <p className="text-sm text-gray-400">No pending submissions</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {pendingSubmissions.map((submission) => {
              const responseData = submission.response_data as {
                total_amount: number;
                items: Array<{
                  description: string;
                  unit_price: number;
                  quantity: number;
                }>;
              };
              return (
                <div 
                  key={submission.id} 
                  className="flex flex-col p-3 bg-[#1A1F36] rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">{submission.invoice_number}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(submission.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-white">
                      KES {responseData?.total_amount?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  {responseData?.items && (
                    <div className="mt-2 space-y-1">
                      {responseData.items.map((item, index) => (
                        <div key={index} className="text-sm text-gray-400 flex justify-between">
                          <span>{item.description}</span>
                          <span>KES {item.unit_price.toFixed(2)} x {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 