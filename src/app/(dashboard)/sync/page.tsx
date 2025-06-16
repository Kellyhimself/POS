'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Upload } from 'lucide-react';
import { SyncFileData } from '@/lib/etims/utils';
import { createClient } from '@/lib/supabase-clients/pages';
import { useRouter } from 'next/navigation';

interface SubmissionResult {
  id: string;
  invoice_number: string;
  status: 'success' | 'error';
  error_message?: string;
  response_data?: unknown;
}

interface BatchResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface SyncFile extends SyncFileData {
  id: string;
}

export default function SyncPage() {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncFile, setSyncFile] = useState<SyncFile | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);

      const text = await file.text();
      const data = JSON.parse(text) as SyncFile;

      // Validate the file data
      if (!data.session_id || !data.store_id || !data.submissions) {
        throw new Error('Invalid sync file format');
      }

      setSyncFile(data);
    } catch (err) {
      console.error('Error processing sync file:', err);
      setError('Failed to process sync file');
    }
  };

  const processSubmissions = async () => {
    if (!syncFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      console.log('🖱️ Submit button clicked');
      console.log('🔄 Starting submission processing:', {
        total_submissions: syncFile.submissions.length,
        store_id: syncFile.store_id,
        timestamp: new Date().toISOString()
      });

      const results: SubmissionResult[] = [];
      const BATCH_SIZE = 20; // Increased batch size for bulk processing
      const BATCH_DELAY = 2000; // 2 second delay between batches

      // Process submissions in batches
      for (let i = 0; i < syncFile.submissions.length; i += BATCH_SIZE) {
        const batch = syncFile.submissions.slice(i, i + BATCH_SIZE);
        console.log(`📦 Processing batch ${i/BATCH_SIZE + 1}:`, {
          batch_size: batch.length,
          start_index: i,
          end_index: i + batch.length,
          timestamp: new Date().toISOString()
        });

        try {
          // Prepare batch for bulk submission
          const batchSubmissions = batch.map(submission => ({
            invoiceData: submission.response_data,
            store_id: syncFile.store_id
          }));

          console.log('🔌 Submitting batch to API:', {
            batch_size: batchSubmissions.length,
            timestamp: new Date().toISOString()
          });

          // Add timeout to the API call
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('API call timed out after 120 seconds')), 120000);
          });

          const response = await Promise.race([
            fetch('/api/etims/submit', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(batchSubmissions)
            }),
            timeoutPromise
          ]) as Response;

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to submit batch');
          }

          const batchResults = await response.json() as BatchResult[];

          // Process results for each submission in the batch
          batchResults.forEach((result, index) => {
            const submission = batch[index];
            if (result.success) {
              results.push({
                id: submission.id,
                invoice_number: submission.invoice_number,
                status: 'success' as const,
                response_data: result.data
              });
            } else {
              results.push({
                id: submission.id,
                invoice_number: submission.invoice_number,
                status: 'error' as const,
                error_message: result.error || 'Unknown error'
              });
            }
          });

          console.log('✅ Batch processed:', {
            batch_number: i/BATCH_SIZE + 1,
            successful: batchResults.filter(r => r.success).length,
            failed: batchResults.filter(r => !r.success).length,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          console.error('❌ Batch processing error:', {
            batch_number: i/BATCH_SIZE + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });

          // Mark all submissions in the batch as failed
          batch.forEach(submission => {
            results.push({
              id: submission.id,
              invoice_number: submission.invoice_number,
              status: 'error' as const,
              error_message: error instanceof Error ? error.message : 'Unknown error'
            });
          });
        }

        // Add delay between batches to prevent overwhelming the system
        if (i + BATCH_SIZE < syncFile.submissions.length) {
          console.log(`⏳ Waiting ${BATCH_DELAY}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      // Update sync file with results
      const { error: updateError } = await supabase
        .from('etims_sync_files')
        .update({ 
          status: 'completed',
          results,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncFile.id);

      if (updateError) throw updateError;

      // Refresh the page to show updated status
      router.refresh();
    } catch (error) {
      console.error('❌ Sync process error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      setError(error instanceof Error ? error.message : 'Failed to process submissions');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0">
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">ETIMS Sync</h1>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="sync-file"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">JSON files only</p>
                    </div>
                    <input
                      id="sync-file"
                      type="file"
                      className="hidden"
                      accept=".json"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                    />
                  </label>
                </div>

                {syncFile && (
                  <div className="mt-4">
                    <Button
                      onClick={processSubmissions}
                      disabled={isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? 'Processing...' : 'Process Submissions'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
} 