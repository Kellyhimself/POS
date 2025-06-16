import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';

// Enhanced retry configuration for bulk processing
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_DELAY = 5000;
const MAX_CONCURRENT_REQUESTS = 5; // Maximum concurrent requests per store
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 50; // Maximum requests per minute per store

// Store rate limit tracking
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to check if error is rate limit related
const isRateLimitError = (error: any): boolean => {
  return error?.message?.includes('rateLimitExceeded') || 
         error?.message?.includes('rate limits') ||
         error?.status === 'PERMISSION_DENIED';
};

// Helper function to check rate limits
function checkRateLimit(storeId: string): boolean {
  const now = Date.now();
  const storeLimit = rateLimitStore.get(storeId);

  if (!storeLimit || now > storeLimit.resetTime) {
    rateLimitStore.set(storeId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (storeLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  storeLimit.count++;
  return true;
}

// Helper function to handle retries with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (!isRateLimitError(error) || attempt === maxRetries - 1) {
        throw lastError;
      }
      
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt) + Math.random() * 100,
        MAX_DELAY
      );
      
      console.log(`Rate limit hit, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
      await wait(delay);
    }
  }
  
  throw lastError;
}

// Helper function to process invoices in parallel with concurrency control
async function processInvoices(
  invoices: Array<{ invoiceData: any; store_id: string }>,
  supabase: any
): Promise<Array<{ success: boolean; data?: any; error?: string }>> {
  const results: Array<{ success: boolean; data?: any; error?: string }> = [];
  const storeConcurrency = new Map<string, number>();

  // Process invoices in parallel with concurrency control
  await Promise.all(
    invoices.map(async (invoice) => {
      const { invoiceData, store_id } = invoice;

      // Check store concurrency
      const currentConcurrency = storeConcurrency.get(store_id) || 0;
      if (currentConcurrency >= MAX_CONCURRENT_REQUESTS) {
        await wait(1000); // Wait if too many concurrent requests
      }
      storeConcurrency.set(store_id, currentConcurrency + 1);

      try {
        // Check rate limit
        if (!checkRateLimit(store_id)) {
          throw new Error('Rate limit exceeded for store');
        }

        // Get store credentials
        const { data: store, error: credentialsError } = await withRetry(async () => {
          const result = await supabase
            .from('stores')
            .select('etims_username, etims_password, kra_pin, kra_token')
            .eq('id', store_id)
            .single();
          
          if (result.error) throw result.error;
          return result;
        });

        if (credentialsError || !store || !store.kra_token) {
          throw new Error(credentialsError?.message || 'Store credentials not found');
        }

        // Submit to KRA eTIMS
        const response = await withRetry(async () => {
          console.log('🚀 Submitting to KRA eTIMS:', {
            invoice_number: invoiceData.invoice_number,
            store_id,
            timestamp: new Date().toISOString()
          });

          const startTime = Date.now();
          const response = await fetch(`${process.env.NEXT_PUBLIC_ETIMS_API_URL}/invoice`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${store.kra_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(invoiceData)
          });

          const endTime = Date.now();
          console.log('⏱️ KRA eTIMS API call duration:', {
            invoice_number: invoiceData.invoice_number,
            store_id,
            duration_ms: endTime - startTime,
            status: response.status
          });

          return response;
        });

        const rawText = await response.text();
        let result;
        try {
          result = JSON.parse(rawText);
        } catch (e) {
          throw new Error(`eTIMS did not return JSON. Status: ${response.status}. Body: ${rawText.substring(0, 1000)}`);
        }

        if (!response.ok) {
          throw new Error(result.message || 'Failed to submit invoice to KRA');
        }

        results.push({ success: true, data: result });
      } catch (error) {
        console.error('❌ Error processing invoice:', {
          invoice_number: invoiceData.invoice_number,
          store_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        results.push({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        // Decrease concurrency counter
        const currentConcurrency = storeConcurrency.get(store_id) || 0;
        storeConcurrency.set(store_id, Math.max(0, currentConcurrency - 1));
      }
    })
  );

  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    // Handle both single and bulk submissions
    const invoices = Array.isArray(body) ? body : [body];

    // Validate all invoices
    for (const invoice of invoices) {
      if (!invoice.invoiceData || !invoice.store_id) {
        return NextResponse.json(
          { error: 'Missing required fields: invoiceData or store_id' },
          { status: 400 }
        );
      }
    }

    // Process all invoices in parallel with concurrency control
    const results = await processInvoices(invoices, supabase);

    // Return results
    if (Array.isArray(body)) {
      return NextResponse.json(results);
    } else {
      const result = results[0];
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }
      return NextResponse.json(result.data);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 