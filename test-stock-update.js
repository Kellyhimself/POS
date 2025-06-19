// Simple test script to verify stock updates
import { db } from './src/lib/db/index.js';

async function testStockUpdate() {
  try {
    console.log('🧪 Testing stock update functionality...');
    
    // Get all products
    const products = await db.products.toArray();
    console.log('📊 Current products:', products.length);
    
    if (products.length === 0) {
      console.log('❌ No products found in database');
      return;
    }
    
    // Test with first product
    const testProduct = products[0];
    console.log('🧪 Testing with product:', {
      id: testProduct.id,
      name: testProduct.name,
      current_quantity: testProduct.quantity
    });
    
    // Update quantity
    const newQuantity = testProduct.quantity + 10;
    await db.products.put({
      ...testProduct,
      quantity: newQuantity,
      synced: false
    });
    
    // Verify update
    const updatedProduct = await db.products.get(testProduct.id);
    console.log('✅ Stock update test result:', {
      product_id: updatedProduct.id,
      name: updatedProduct.name,
      old_quantity: testProduct.quantity,
      new_quantity: updatedProduct.quantity,
      synced: updatedProduct.synced
    });
    
    console.log('✅ Stock update test completed successfully');
  } catch (error) {
    console.error('❌ Stock update test failed:', error);
  }
}

// Run test
testStockUpdate(); 