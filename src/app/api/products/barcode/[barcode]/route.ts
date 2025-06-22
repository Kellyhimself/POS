import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';
import { getProductByBarcode } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { barcode: string } }
) {
  try {
    const { barcode } = params;
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      );
    }

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barcode is required' },
        { status: 400 }
      );
    }

    console.log('🔍 API: Looking up product by barcode:', { barcode, storeId });

    // Create Supabase client
    const supabase = createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has access to this store
    const { data: userStore } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', user.id)
      .single();

    if (!userStore || userStore.store_id !== storeId) {
      return NextResponse.json(
        { error: 'Access denied to this store' },
        { status: 403 }
      );
    }

    // Look up product by barcode using the database function
    const { data: product, error } = await supabase
      .rpc('get_product_by_barcode', {
        p_barcode: barcode,
        p_store_id: storeId
      });

    if (error) {
      console.error('❌ API: Database error:', error);
      return NextResponse.json(
        { error: 'Database error occurred' },
        { status: 500 }
      );
    }

    if (!product || product.length === 0) {
      console.log('⚠️ API: Product not found for barcode:', barcode);
      return NextResponse.json(
        { 
          success: false,
          message: 'Product not found',
          data: null 
        },
        { status: 404 }
      );
    }

    const productData = product[0];
    console.log('✅ API: Product found:', { 
      id: productData.id, 
      name: productData.name, 
      barcode: productData.barcode 
    });

    return NextResponse.json({
      success: true,
      message: 'Product found',
      data: productData
    });

  } catch (error) {
    console.error('❌ API: Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 