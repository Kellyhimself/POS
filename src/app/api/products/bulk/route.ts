import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';
import { 
  importProductsFromCSV, 
  validateBulkUpdate, 
  generateBulkUpdateSQL,
  BulkProductUpdate 
} from '@/lib/bulk-operations/utils';

export async function POST(request: Request) {
  try {
    const { csvContent, store_id } = await request.json();

    if (!csvContent) {
      return NextResponse.json(
        { error: 'CSV content is required' },
        { status: 400 }
      );
    }

    if (!store_id) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      );
    }

    // Parse and validate CSV data
    const updates = importProductsFromCSV(csvContent);
    const validationErrors = validateBulkUpdate(updates);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // Generate and execute SQL updates
    const supabase = await createClient();
    const sql = generateBulkUpdateSQL(updates);
    
    const { error } = await supabase.rpc('execute_bulk_update', {
      p_sql: sql,
      p_store_id: store_id
    });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update products', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updates.length} products`
    });
  } catch (error) {
    console.error('Bulk Update Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process bulk update' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const store_id = searchParams.get('store_id');

    if (!store_id) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', store_id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch products', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Bulk Export Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to export products' },
      { status: 500 }
    );
  }
} 