import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { amount, phone, store_id } = await request.json();
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: any) {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          },
        },
      }
    );

    // Get store's M-Pesa credentials
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('mpesa_details')
      .eq('id', store_id)
      .single();

    if (storeError) throw storeError;

    // Format phone number (remove leading 0 and add country code)
    const formattedPhone = phone.startsWith('0') ? `254${phone.slice(1)}` : phone;

    // Call M-Pesa API (this is a mock implementation)
    // In production, you would use the actual M-Pesa API
    const mpesaResponse = {
      success: true,
      checkoutRequestId: `ws_CO_${Date.now()}`,
      merchantRequestId: `MER-${Date.now()}`,
      responseCode: '0',
      responseDescription: 'Success. Request accepted for processing',
      customerMessage: 'Please enter your M-Pesa PIN to complete the transaction.'
    };

    return NextResponse.json(mpesaResponse);
  } catch (error) {
    console.error('M-Pesa error:', error);
    return NextResponse.json(
      { error: 'Failed to process M-Pesa payment' },
      { status: 500 }
    );
  }
} 