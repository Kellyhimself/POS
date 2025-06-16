import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Retry configuration
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 500;
const MAX_DELAY = 2000;

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to check if error is rate limit related
const isRateLimitError = (error: any): boolean => {
  return error?.message?.includes('rateLimitExceeded') || 
         error?.message?.includes('rate limits') ||
         error?.status === 'PERMISSION_DENIED';
};

// Helper function to handle retries
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

interface EtimsInvoice {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_tax_pin: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_amount: number;
  }>;
  total_amount: number;
  vat_total: number;
  store_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let parsedBody: { invoiceData: EtimsInvoice; store_id: string } | null = null;

  try {
    // Parse request body
    let invoiceData: EtimsInvoice;
    let store_id: string;
    
    try {
      console.log('📥 Received request:', {
        method: req.method,
        headers: Object.fromEntries(req.headers.entries()),
        url: req.url
      });

      parsedBody = await req.json();
      console.log('📦 Request body:', JSON.stringify(parsedBody, null, 2));

      invoiceData = parsedBody.invoiceData;
      store_id = parsedBody.store_id;
      
      if (!invoiceData || !store_id) {
        console.error('❌ Missing required fields:', {
          hasInvoiceData: !!invoiceData,
          hasStoreId: !!store_id,
          body: parsedBody
        });
        throw new Error('Missing required fields: invoiceData or store_id');
      }

      console.log('✅ Request validation passed:', {
        invoice_number: invoiceData.invoice_number,
        store_id,
        items_count: invoiceData.items?.length
      });
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        stack: parseError instanceof Error ? parseError.stack : undefined
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown error'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }
    
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey
      });
      throw new Error('Missing required environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Get KRA credentials with retry
    const { data: store, error: credentialsError } = await withRetry(async () => {
      const result = await supabaseClient
        .from('stores')
        .select('etims_username, etims_password, kra_pin, kra_token')
        .eq('id', store_id)
        .single();
      
      if (result.error) throw result.error;
      return result;
    });

    if (credentialsError) {
      console.error('Failed to fetch KRA credentials:', credentialsError);
      throw new Error(`Failed to fetch KRA credentials: ${credentialsError.message}`);
    }

    if (!store) {
      console.error('Store not found:', { store_id });
      throw new Error('Store not found');
    }

    if (!store.kra_token) {
      console.error('Missing KRA token for store:', { store_id });
      throw new Error('Missing KRA token for store');
    }

    // Submit to KRA eTIMS with retry
    const response = await withRetry(async () => {
      console.log('🚀 Submitting to KRA eTIMS:', {
        invoice_number: invoiceData.invoice_number,
        store_id,
        timestamp: new Date().toISOString()
      });

      const startTime = Date.now();
      const response = await fetch(`${Deno.env.get('NEXT_PUBLIC_ETIMS_API_URL')}/invoice`, {
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
    }, {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
      // Add jitter to prevent thundering herd
      jitter: true
    });

    // Log the raw response body before parsing
    const rawText = await response.text();
    console.log('📥 Raw eTIMS response:', {
      invoice_number: invoiceData.invoice_number,
      store_id,
      status: response.status,
      response_length: rawText.length,
      timestamp: new Date().toISOString()
    });

    let result;
    try {
      result = JSON.parse(rawText);
    } catch (e) {
      console.error('❌ Failed to parse eTIMS response:', {
        invoice_number: invoiceData.invoice_number,
        store_id,
        status: response.status,
        rawText: rawText.substring(0, 1000),
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw new Error(`eTIMS did not return JSON. Status: ${response.status}. Body: ${rawText.substring(0, 1000)}`);
    }

    // Log the response
    console.log('✅ eTIMS API Response:', {
      invoice_number: invoiceData.invoice_number,
      store_id,
      status: response.status,
      response: result,
      timestamp: new Date().toISOString()
    });

    if (!response.ok) {
      console.error('❌ eTIMS API error response:', {
        invoice_number: invoiceData.invoice_number,
        store_id,
        status: response.status,
        error: result.message || 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw new Error(result.message || 'Failed to submit invoice to KRA');
    }

    // Store the submission record with retry
    await withRetry(async () => {
      console.log('💾 Storing submission record:', {
        invoice_number: invoiceData.invoice_number,
        store_id,
        timestamp: new Date().toISOString()
      });

      const { error: recordError } = await supabaseClient
        .from('etims_submissions')
        .insert({
          invoice_number: invoiceData.invoice_number,
          store_id,
          status: 'success',
          response_data: result,
          submitted_at: new Date().toISOString()
        });

      if (recordError) {
        console.error('❌ Failed to store submission record:', {
          invoice_number: invoiceData.invoice_number,
          store_id,
          error: recordError.message,
          timestamp: new Date().toISOString()
        });
        throw recordError;
      }

      console.log('✅ Submission record stored:', {
        invoice_number: invoiceData.invoice_number,
        store_id,
        timestamp: new Date().toISOString()
      });
    }, {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
      jitter: true
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        message: 'Invoice successfully submitted to KRA eTIMS'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('eTIMS submission error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Record the failed submission with retry
    try {
      if (parsedBody) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SERVICE_ROLE_KEY') ?? ''
        );

        await withRetry(async () => {
          const { error: recordError } = await supabaseClient
            .from('etims_submissions')
            .insert({
              invoice_number: parsedBody.invoiceData.invoice_number,
              store_id: parsedBody.store_id,
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              submitted_at: new Date().toISOString()
            });
          
          if (recordError) throw recordError;
        });
      }
    } catch (recordError) {
      console.error('Failed to record failed submission:', recordError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit invoice to KRA eTIMS',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}); 