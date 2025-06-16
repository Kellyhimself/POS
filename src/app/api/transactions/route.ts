import { createClient } from '@/lib/supabase-clients/server';
import { createServiceRoleClient } from '@/lib/supabase-clients/service-role';
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

    // Create sale record (returns first transaction id)
    const { data: firstTransactionId, error: saleError } = await createSale({
      store_id,
      products: mappedProducts,
      payment_method: payment_method as 'cash' | 'mpesa',
      total_amount,
      vat_total
    });

    if (saleError) {
      const error = saleError as SaleError;
      return NextResponse.json({ error: `Failed to create sale: ${error.message}` }, { status: 500 });
    }

    if (!firstTransactionId) {
      throw new Error('No transaction ID returned from sale creation');
    }

    // Fetch all transactions for this sale
    const supabase = await createClient();
    const serviceClient = await createServiceRoleClient();
    
    // Add retry mechanism with exponential backoff
    let transactions = null;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 500; // 500ms base delay
    
    while (retryCount < maxRetries) {
      const { data: fetchedTransactions, error: transactionError } = await serviceClient
      .from('transactions')
      .select('*')
      .eq('store_id', store_id)
        .gte('timestamp', new Date(Date.now() - 5000).toISOString())
      .order('timestamp', { ascending: false });
    
    if (transactionError) {
      throw transactionError;
      }
      
      if (fetchedTransactions && fetchedTransactions.length > 0) {
        transactions = fetchedTransactions;
        break;
      }
      
      // Wait with exponential backoff before retrying
      const delay = baseDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      retryCount++;
    }
    
    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions found after creation');
    }

    // Use the first transaction for receipt generation
    const transaction = transactions[0];

    // Fetch store details for receipt
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, address')
      .eq('id', store_id)
      .single();
    
    if (storeError) {
      throw storeError;
    }

    // Generate receipt object
    const receipt = {
      store: {
        id: store.id,
        name: store.name,
        address: store.address
      },
      sale: {
        id: firstTransactionId,
        created_at: transaction.timestamp || new Date().toISOString(),
        payment_method: transaction.payment_method,
        subtotal: total_amount - vat_total,
        vat_total: vat_total,
        total: total_amount,
        products: mappedProducts.map((p: Product) => ({
          id: p.id,
          name: p.name,
          quantity: p.quantity,
          price: p.displayPrice || p.price,
          vat_amount: p.vat_amount,
          vat_status: p.vat_amount > 0 ? 'VATABLE' : 'EXEMPT',
          total: (p.displayPrice || p.price) * p.quantity
        }))
      }
    };

    let etimsResult = null;
    let etimsValidationErrors = null;

    // Submit to eTIMS if VAT is applicable
    if (vat_total > 0) {
      try {
        console.log('📝 Preparing eTIMS submission:', {
          vat_total,
          store_id,
          transaction_id: firstTransactionId
        });

        const invoice = formatEtimsInvoice(transaction, mappedProducts, store_id);
        console.log('📄 Formatted eTIMS invoice:', {
          invoice_number: invoice.invoice_number,
          total_amount: invoice.total_amount,
          vat_total: invoice.vat_total,
          items_count: invoice.items.length
        });

        const validationErrors = validateEtimsInvoice(invoice);
        console.log('🔍 eTIMS validation results:', {
          has_errors: validationErrors.length > 0,
          errors: validationErrors
        });
        
        if (validationErrors.length === 0) {
          const { data: etimsData, error: etimsError } = await submitEtimsInvoice(invoice);
          
          if (etimsError) {
            console.error('❌ eTIMS submission error:', etimsError);
            etimsResult = { 
              error: etimsError.message || etimsError,
              details: 'Failed to submit invoice to KRA eTIMS'
            };
          } else {
            console.log('✅ eTIMS submission successful:', {
              invoice_number: etimsData.invoice_number,
              status: etimsData.status
            });
            etimsResult = { 
              success: true,
              data: etimsData,
              message: 'Invoice successfully submitted to KRA eTIMS'
            };
          }
        } else {
          console.warn('⚠️ eTIMS validation failed:', validationErrors);
          etimsValidationErrors = validationErrors;
        }
      } catch (error) {
        console.error('❌ Error in eTIMS process:', error);
        etimsResult = { 
          error: error instanceof Error ? error.message : 'Unknown error',
          details: 'Failed to process eTIMS submission'
        };
      }
    } else {
      console.log('ℹ️ Skipping eTIMS submission - no VAT applicable');
    }

    return NextResponse.json({
      success: true,
      transactions,
      receipt,
      etims: etimsResult,
      etimsValidationErrors
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
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