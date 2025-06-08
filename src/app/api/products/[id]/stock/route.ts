import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { quantity_change } = body;

    if (typeof quantity_change !== 'number') {
      return NextResponse.json(
        { error: 'quantity_change must be a number' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current product
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError) throw fetchError;
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Update stock using the update_stock function
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_stock', {
        p_product_id: params.id,
        p_quantity_change: quantity_change,
        p_store_id: product.store_id
      });

    if (updateError) throw updateError;

    // Get updated product
    const { data: updatedProduct, error: getError } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.id)
      .single();

    if (getError) throw getError;

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 