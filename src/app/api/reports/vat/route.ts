import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';
import { Database } from '@/types/supabase';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const store_id = searchParams.get('store_id');
  const start_date = searchParams.get('start_date');
  const end_date = searchParams.get('end_date');
  const product_name = searchParams.get('product_name');
  const category = searchParams.get('category');

  if (!store_id) {
    return NextResponse.json({ error: 'Missing store_id' }, { status: 400 });
  }

  let query = supabase
    .from('transactions')
    .select(`
      id,
      product_id,
      quantity,
      total,
      vat_amount,
      payment_method,
      timestamp,
      products:product_id (name, sku, selling_price, vat_status, category)
    `)
    .eq('store_id', store_id)
    .order('timestamp', { ascending: false });

  if (start_date) {
    query = query.gte('timestamp', start_date);
  }
  if (end_date) {
    query = query.lte('timestamp', end_date);
  }

  // Fetch data
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by product_name and category in JS (Supabase does not support join filters directly)
  let filtered = data || [];
  if (product_name) {
    filtered = filtered.filter(tx => tx.products?.name?.toLowerCase().includes(product_name.toLowerCase()));
  }
  if (category) {
    filtered = filtered.filter(tx => tx.products?.category?.toLowerCase().includes(category.toLowerCase()));
  }

  // Initialize summary and category breakdowns
  let vat_total = 0;
  let taxable_total = 0;
  let exempt_total = 0;
  const categoryBreakdown = new Map<string, { vat_total: number; taxable_total: number; exempt_total: number }>();

  // Process transactions
  filtered.forEach(tx => {
    const productCategory = tx.products?.category || 'Uncategorized';
    if (!categoryBreakdown.has(productCategory)) {
      categoryBreakdown.set(productCategory, { vat_total: 0, taxable_total: 0, exempt_total: 0 });
    }
    const categoryTotals = categoryBreakdown.get(productCategory)!;

    if (tx.products?.vat_status) {
      taxable_total += tx.total;
      vat_total += tx.vat_amount || 0;
      categoryTotals.taxable_total += tx.total;
      categoryTotals.vat_total += tx.vat_amount || 0;
    } else {
      exempt_total += tx.total;
      categoryTotals.exempt_total += tx.total;
    }
  });

  // Convert category breakdown to array
  const categorySummary = Array.from(categoryBreakdown.entries()).map(([category, totals]) => ({
    category,
    ...totals
  }));

  return NextResponse.json({
    data: {
      vat_total,
      taxable_total,
      exempt_total,
      category_breakdown: categorySummary
    }
  });
} 