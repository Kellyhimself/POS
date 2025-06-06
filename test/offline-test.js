const { chromium } = require('playwright');
const { expect } = require('@playwright/test');

async function runTests() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Starting offline functionality tests...');

  try {
    // Test 1: Basic offline detection
    console.log('Test 1: Testing offline detection...');
    await page.goto('http://localhost:3000');
    await page.route('**/api/**', route => route.abort('failed'));
    await page.reload();
    await expect(page.locator('text=You\'re Offline')).toBeVisible();
    console.log('✓ Offline detection works');

    // Test 2: Offline sales
    console.log('Test 2: Testing offline sales...');
    await page.goto('http://localhost:3000/pos');
    await page.route('**/api/**', route => route.abort('failed'));
    
    // Add items to cart
    await page.click('button:has-text("Add Item")');
    await page.fill('input[name="quantity"]', '2');
    await page.click('button:has-text("Add to Cart")');
    
    // Complete sale
    await page.click('button:has-text("Complete Sale")');
    await expect(page.locator('text=Sale completed offline')).toBeVisible();
    console.log('✓ Offline sales work');

    // Test 3: Offline inventory updates
    console.log('Test 3: Testing offline inventory updates...');
    await page.goto('http://localhost:3000/inventory');
    await page.route('**/api/**', route => route.abort('failed'));
    
    // Update inventory
    await page.click('button:has-text("Update Stock")');
    await page.fill('input[name="quantity"]', '10');
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=Update saved offline')).toBeVisible();
    console.log('✓ Offline inventory updates work');

    // Test 4: Sync after coming back online
    console.log('Test 4: Testing sync after coming back online...');
    await page.route('**/api/**', route => route.continue());
    await page.reload();
    await expect(page.locator('text=Syncing data...')).toBeVisible();
    await expect(page.locator('text=Sync complete')).toBeVisible({ timeout: 10000 });
    console.log('✓ Sync works after coming back online');

    // Test 5: Offline reports
    console.log('Test 5: Testing offline reports...');
    await page.route('**/api/**', route => route.abort('failed'));
    await page.goto('http://localhost:3000/reports');
    await page.click('button:has-text("Generate Report")');
    await expect(page.locator('text=Report generated from offline data')).toBeVisible();
    console.log('✓ Offline reports work');

    console.log('\nAll tests passed successfully! 🎉');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests(); 