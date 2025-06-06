import { createClient } from '@/lib/supabase-clients/server';
import { NextResponse } from 'next/server';
import { processMpesaPayment, createSale } from '../supabase/edge-functions';
import { formatEtimsInvoice, validateEtimsInvoice, submitEtimsInvoice } from '@/lib/etims/utils';
import { Database } from '@/types/supabase';

type Product = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  vat_amount: number;
  displayPrice?: number;
  saleMode?: 'retail' | 'wholesale';
};

type SaleError = {
  message: string;
  code?: string;
};

export async function POST(request: Request) {
  try {
    const { store_id, products, payment_method, total_amount, vat_total, customer_phone } = await request.json();

    // Validate required fields
    if (!store_id) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }
    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Products array is required and must not be empty' }, { status: 400 });
    }
    if (!payment_method) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });
    }
    if (typeof total_amount !== 'number') {
      return NextResponse.json({ error: 'Total amount must be a number' }, { status: 400 });
    }

    // Process payment based on method
    if (payment_method === 'mpesa' && customer_phone) {
      const { error: mpesaError } = await processMpesaPayment(total_amount, customer_phone, store_id);
      if (mpesaError) {
        return NextResponse.json({ error: `M-Pesa payment failed: ${mpesaError}` }, { status: 400 });
      }
    }

    // Map products to match createSale expected structure
    const mappedProducts = products.map((p: Product) => ({
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      price: p.displayPrice || p.price,
      vat_amount: p.vat_amount,
      saleMode: p.saleMode || 'retail',
      displayPrice: p.displayPrice || p.price
    }));

    // Create sale record (returns transaction id)
    const { data: transactionId, error: saleError } = await createSale({
      store_id,
      products: mappedProducts,
      payment_method: payment_method as 'cash' | 'mpesa',
      total_amount,
      vat_total
    });

    if (saleError) {
      console.error('Sale creation error:', saleError);
      const error = saleError as SaleError;
      return NextResponse.json({ error: `Failed to create sale: ${error.message}` }, { status: 500 });
    }

    // Fetch the transaction record
    const supabase = await createClient();
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();
    if (transactionError) throw transactionError;

    // Fetch store details for receipt
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, address')
      .eq('id', store_id)
      .single();
    if (storeError) throw storeError;

    // Generate receipt object
    const receipt = {
      store: {
        id: store.id,
        name: store.name,
        address: store.address
      },
      sale: {
        id: transaction.id,
        created_at: transaction.timestamp || new Date().toISOString(),
        payment_method: transaction.payment_method,
        subtotal: transaction.total - (transaction.vat_amount || 0),
        vat_total: transaction.vat_amount || 0,
        total: transaction.total,
        products: mappedProducts.map((p: Product) => ({
          id: p.id,
          name: p.name,
          quantity: p.quantity,
          price: p.price,
          vat_amount: p.vat_amount,
          vat_status: p.vat_amount > 0 ? 'VATABLE' : 'EXEMPT',
          total: p.price * p.quantity
        }))
      }
    };

    let etimsResult = null;
    let etimsValidationErrors = null;

    // Submit to eTIMS if VAT is applicable
    if ((transaction.vat_amount || 0) > 0) {
      try {
        // Use helpers for formatting and validation
        const invoice = formatEtimsInvoice(transaction, mappedProducts, store_id);
        const validationErrors = validateEtimsInvoice(invoice);
        
        if (validationErrors.length === 0) {
          console.log('Submitting invoice to eTIMS:', {
            invoice_number: invoice.invoice_number,
            date: invoice.date,
            total_amount: invoice.total_amount,
            vat_total: invoice.vat_total
          });
          
          const { data: etimsData, error: etimsError } = await submitEtimsInvoice(invoice);
          
          if (etimsError) {
            console.error('eTIMS submission error:', etimsError);
            etimsResult = { 
              error: etimsError.message || etimsError,
              details: 'Failed to submit invoice to KRA eTIMS'
            };
          } else {
            console.log('eTIMS submission successful:', etimsData);
            etimsResult = { 
              success: true,
              data: etimsData,
              message: 'Invoice successfully submitted to KRA eTIMS'
            };
          }
        } else {
          console.error('eTIMS validation errors:', validationErrors);
          etimsValidationErrors = validationErrors;
        }
      } catch (error) {
        console.error('Unexpected error during eTIMS submission:', error);
        etimsResult = { 
          error: error instanceof Error ? error.message : 'Unknown error',
          details: 'Failed to process eTIMS submission'
        };
      }
    }

    return NextResponse.json({
      success: true,
      transaction,
      receipt,
      etims: etimsResult,
      etimsValidationErrors
    });
  } catch (error) {
    console.error('Transaction processing error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process transaction',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const store_id = searchParams.get('store_id');
    const supabase = await createClient();

    if (!store_id) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const { data: transactions, error } = await supabase
      .from('sales')
      .select(`
        *,
        products:sale_items(
          product:products(
            name,
            sku,
            unit_of_measure,
            units_per_pack
          ),
          quantity,
          price,
          vat_amount
        )
      `)
      .eq('store_id', store_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(transactions);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
} 