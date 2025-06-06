import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';
import { Database } from '@/types/supabase';

const LOW_STOCK_THRESHOLD = 10;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const store_id = searchParams.get('store_id');
  const product_name = searchParams.get('product_name');
  const category = searchParams.get('category');

  if (!store_id) {
    return NextResponse.json({ error: 'Missing store_id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', store_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add low-stock status and filter by product_name/category
  let products = (data || []).map(product => ({
    ...product,
    low_stock: product.quantity <= LOW_STOCK_THRESHOLD
  }));

  if (product_name) {
    products = products.filter(p => p.name.toLowerCase().includes(product_name.toLowerCase()));
  }
  if (category) {
    products = products.filter(p => (p.category || '').toLowerCase().includes(category.toLowerCase()));
  }

  return NextResponse.json({ data: products });
} 