import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  try {
    const { invoiceData, store_id } = await req.json()
    
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // Log the submission attempt
    console.log('Attempting to submit invoice to eTIMS:', {
      invoice_number: invoiceData.invoice_number,
      store_id,
      timestamp: new Date().toISOString()
    })

    // Get KRA credentials for the store from the stores table
    const { data: store, error: credentialsError } = await supabaseClient
      .from('stores')
      .select('etims_username, etims_password, kra_pin, kra_token')
      .eq('id', store_id)
      .single()

    if (credentialsError || !store) {
      console.error('Failed to fetch KRA credentials:', credentialsError)
      throw new Error('Failed to fetch KRA credentials')
    }

    // Submit to KRA eTIMS
    const response = await fetch('https://etims.kra.go.ke/api/invoice', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${store.kra_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoiceData)
    })

    // Log the raw response body before parsing
    const rawText = await response.text();
    console.log('Raw eTIMS response:', rawText);

    let result;
    try {
      result = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`eTIMS did not return JSON. Status: ${response.status}. Body: ${rawText}`);
    }

    // Log the response
    console.log('eTIMS API Response:', {
      invoice_number: invoiceData.invoice_number,
      status: response.status,
      response: result
    })

    if (!response.ok) {
      throw new Error(result.message || 'Failed to submit invoice to KRA')
    }

    // Store the submission record
    const { error: recordError } = await supabaseClient
      .from('etims_submissions')
      .insert({
        invoice_number: invoiceData.invoice_number,
        store_id,
        status: 'success',
        response_data: result,
        submitted_at: new Date().toISOString()
      })

    if (recordError) {
      console.error('Failed to record eTIMS submission:', recordError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        message: 'Invoice successfully submitted to KRA eTIMS'
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('eTIMS submission error:', error)

    // Record the failed submission
    try {
      const { invoiceData, store_id } = await req.json().catch(() => ({ invoiceData: undefined, store_id: undefined }))
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SERVICE_ROLE_KEY') ?? ''
      )

      await supabaseClient
        .from('etims_submissions')
        .insert({
          invoice_number: invoiceData?.invoice_number,
          store_id: store_id,
          status: 'failed',
          error_message: error.message,
          submitted_at: new Date().toISOString()
        })
    } catch (recordError) {
      console.error('Failed to record failed submission:', recordError)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to submit invoice to KRA eTIMS'
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}) 