import { NextResponse } from 'next/server';
import { createSale } from '../supabase/edge-functions';
import { createClient } from '@/lib/supabase-clients/server';
import { generateInvoiceNumber } from '@/lib/etims/utils';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export async function POST() {
  try {
    // Test sale data
    const testSale = {
      store_id: "4cbd99cc-ec75-4c95-9cb3-9df170f4242a", // Your store ID
      products: [
        {
          id: "a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d", // Mumias Sugar 2kg
          name: "Mumias Sugar 2kg",
          quantity: 2,
          price: 210.00,
          vat_amount: 33.60, // 16% VAT
          saleMode: 'retail' as const
        }
      ],
      payment_method: "cash" as const,
      total_amount: 420.00,
      vat_total: 33.60
    };

    // Create the sale
    const { data: transactionId, error: saleError } = await createSale(testSale);
    
    if (saleError) {
      console.error('Sale creation error:', saleError);
      return NextResponse.json({ error: getErrorMessage(saleError) }, { status: 500 });
    }

    // Fetch the full transaction record
    const supabase = await createClient();
    const { data: transaction, error: transactionFetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (transactionFetchError) {
      console.error('Error fetching transaction record:', transactionFetchError);
      return NextResponse.json({ error: getErrorMessage(transactionFetchError) }, { status: 500 });
    }

    // Generate the invoice number using the same logic as eTIMS integration
    const invoice_number = generateInvoiceNumber(testSale.store_id, transaction.timestamp || new Date().toISOString());

    // Fetch the eTIMS submission by invoice_number
    const { data: etimsRecord, error: etimsError } = await supabase
      .from('etims_submissions')
      .select('*')
      .eq('invoice_number', invoice_number)
      .single();

    if (etimsError) {
      console.error('Error fetching eTIMS record:', etimsError);
    }

    return NextResponse.json({
      success: true,
      transaction,
      invoice_number,
      etims_submission: etimsRecord
    });

  } catch (error: unknown) {
    console.error('Test sale error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
} 