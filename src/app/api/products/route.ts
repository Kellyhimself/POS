import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';

// GET /api/products?store_id=xxx
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const store_id = searchParams.get('store_id');
    let query = supabase.from('products').select('*');
    if (store_id) {
      query = query.eq('store_id', store_id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/products
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Validate required fields
    const requiredFields = [
      'name', 'sku', 'quantity', 'unit_of_measure', 'units_per_pack', 
      'retail_price', 'wholesale_price', 'wholesale_threshold',
      'cost_price', 'vat_status', 'category', 'store_id'
    ];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          name: body.name,
          sku: body.sku,
          quantity: body.quantity,
          unit_of_measure: body.unit_of_measure,
          units_per_pack: body.units_per_pack,
          retail_price: body.retail_price,
          wholesale_price: body.wholesale_price,
          wholesale_threshold: body.wholesale_threshold,
          cost_price: body.cost_price,
          vat_status: body.vat_status,
          category: body.category,
          store_id: body.store_id,
          parent_product_id: body.parent_product_id || null,
        }
      ])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 