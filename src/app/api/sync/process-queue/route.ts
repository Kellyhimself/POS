import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';
import { createSale, updateStock } from '../../supabase/edge-functions';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { sales, stockUpdates } = await request.json();

    // Process sales
    for (const sale of sales) {
      try {
        await createSale(sale);
      } catch (error) {
        console.error('Failed to sync sale:', error);
        // Continue with other sales even if one fails
      }
    }

    // Process stock updates
    for (const update of stockUpdates) {
      try {
        await updateStock(
          update.product_id,
          update.quantity_change,
          update.store_id
        );
      } catch (error) {
        console.error('Failed to sync stock update:', error);
        // Continue with other updates even if one fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sync queue processing failed:', error);
    return NextResponse.json(
      { error: 'Failed to process sync queue' },
      { status: 500 }
    );
  }
} 