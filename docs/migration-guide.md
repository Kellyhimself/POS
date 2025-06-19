# Migration Guide: From Sync Hooks to Unified Services

## Overview

This guide helps you migrate from the old sync hooks (`useGlobalProductSync`, `useGlobalSaleSync`, etc.) to the new unified service approach that supports both online and offline modes seamlessly.

## What's Changed

### Before (Old Sync Hooks)
```typescript
// Old approach - separate hooks for different concerns
import { useGlobalProductSync } from '@/lib/hooks/useGlobalProductSync';
import { useGlobalSaleSync } from '@/lib/hooks/useGlobalSaleSync';
import { useGlobalPurchaseSync } from '@/lib/hooks/useGlobalPurchaseSync';

// In component
const { isSyncing, lastSyncTime } = useGlobalProductSync();
const { isSyncing: salesSyncing } = useGlobalSaleSync();
```

### After (Unified Services)
```typescript
// New approach - unified service with mode awareness
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';

// In component
const { currentMode, isOnlineMode, getProducts, createSale } = useUnifiedService();
```

## Migration Steps

### Step 1: Replace Hook Imports

**Before:**
```typescript
import { useGlobalProductSync } from '@/lib/hooks/useGlobalProductSync';
import { useGlobalSaleSync } from '@/lib/hooks/useGlobalSaleSync';
import { useGlobalPurchaseSync } from '@/lib/hooks/useGlobalPurchaseSync';
import { useGlobalSupplierSync } from '@/lib/hooks/useGlobalSupplierSync';
```

**After:**
```typescript
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
```

### Step 2: Replace Hook Usage

**Before:**
```typescript
const { isSyncing, lastSyncTime, syncStatus } = useGlobalProductSync();
const { isSyncing: salesSyncing } = useGlobalSaleSync();
```

**After:**
```typescript
const { 
  currentMode, 
  isOnlineMode, 
  isOfflineMode,
  getProducts,
  createSale,
  updateProduct,
  getTransactions 
} = useUnifiedService();
```

### Step 3: Update Data Fetching

**Before:**
```typescript
const { data: products, isLoading } = useQuery({
  queryKey: ['products', storeId],
  queryFn: async () => {
    return await syncService.getProducts(storeId);
  },
  enabled: !!storeId,
});
```

**After:**
```typescript
const { data: products, isLoading } = useQuery({
  queryKey: ['products', storeId, currentMode], // Include mode in key
  queryFn: async () => {
    return await getProducts(storeId);
  },
  enabled: !!storeId,
});
```

### Step 4: Update Mutations

**Before:**
```typescript
const createProductMutation = useMutation({
  mutationFn: async (productData) => {
    return await syncService.createProduct(productData);
  },
});
```

**After:**
```typescript
const createProductMutation = useMutation({
  mutationFn: async (productData) => {
    return await createProduct(productData);
  },
});
```

## Complete Migration Examples

### Example 1: Product Management Component

**Before:**
```typescript
import { useGlobalProductSync } from '@/lib/hooks/useGlobalProductSync';
import { syncService } from '@/lib/sync';

export function ProductList() {
  const { isSyncing, lastSyncTime } = useGlobalProductSync();
  const { data: products } = useQuery({
    queryKey: ['products', storeId],
    queryFn: () => syncService.getProducts(storeId),
  });

  return (
    <div>
      {isSyncing && <div>Syncing...</div>}
      {products?.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

**After:**
```typescript
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';

export function ProductList() {
  const { currentMode, isOnlineMode, getProducts } = useUnifiedService();
  const { data: products } = useQuery({
    queryKey: ['products', storeId, currentMode],
    queryFn: () => getProducts(storeId),
  });

  return (
    <div>
      <div className="text-sm text-gray-500">
        Mode: {currentMode === 'online' ? '🟢 Online' : '🟡 Offline'}
      </div>
      {products?.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

### Example 2: Sales Component

**Before:**
```typescript
import { useGlobalSaleSync } from '@/lib/hooks/useGlobalSaleSync';
import { syncService } from '@/lib/sync';

export function SalesPage() {
  const { isSyncing } = useGlobalSaleSync();
  
  const createSaleMutation = useMutation({
    mutationFn: async (saleData) => {
      return await syncService.createSale(saleData);
    },
  });

  return (
    <div>
      {isSyncing && <div>Syncing sales...</div>}
      <button onClick={() => createSaleMutation.mutate(saleData)}>
        Create Sale
      </button>
    </div>
  );
}
```

**After:**
```typescript
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';

export function SalesPage() {
  const { currentMode, createSale } = useUnifiedService();
  
  const createSaleMutation = useMutation({
    mutationFn: async (saleData) => {
      return await createSale(saleData);
    },
  });

  return (
    <div>
      <div className="text-sm text-gray-500 mb-4">
        Mode: {currentMode === 'online' ? '🟢 Online' : '🟡 Offline'}
      </div>
      <button onClick={() => createSaleMutation.mutate(saleData)}>
        Create Sale
      </button>
    </div>
  );
}
```

## Mode-Aware UI Components

### Mode Indicator
```typescript
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';

export function ModeAwareComponent() {
  const { currentMode, isOnlineMode, isOfflineMode } = useUnifiedService();

  return (
    <div>
      <div className={`px-2 py-1 rounded text-xs ${
        isOnlineMode 
          ? 'bg-green-100 text-green-800' 
          : 'bg-yellow-100 text-yellow-800'
      }`}>
        {currentMode === 'online' ? '🟢 Online' : '🟡 Offline'}
      </div>
      
      {isOfflineMode && (
        <div className="text-xs text-gray-500 mt-1">
          Working offline. Changes will sync when connection is restored.
        </div>
      )}
    </div>
  );
}
```

### Conditional Features
```typescript
export function FeatureComponent() {
  const { isOnlineMode } = useUnifiedService();

  return (
    <div>
      {/* Always available */}
      <button>Create Product</button>
      
      {/* Online-only features */}
      {isOnlineMode && (
        <button>Real-time Analytics</button>
      )}
      
      {/* Offline-only features */}
      {!isOnlineMode && (
        <div className="text-sm text-gray-500">
          Sync pending: 5 items
        </div>
      )}
    </div>
  );
}
```

## Available Unified Service Methods

### Products
- `getProducts(storeId: string)` - Get all products
- `createProduct(productData)` - Create new product
- `updateProduct(productId, updates)` - Update product
- `updateStock(productId, quantityChange, version?)` - Update stock

### Sales/Transactions
- `getTransactions(storeId, startDate?, endDate?)` - Get transactions
- `createSale(saleData)` - Create new sale
- `submitToETIMS(invoiceData)` - Submit to ETIMS

### Sync Management
- `getPendingSyncCount()` - Get count of pending sync items
- `syncPendingData()` - Sync pending data

### Mode Information
- `currentMode` - Current mode ('online' | 'offline')
- `isOnlineMode` - Boolean for online mode
- `isOfflineMode` - Boolean for offline mode

## Benefits of Migration

### 1. Simplified Code
- Single hook instead of multiple sync hooks
- Consistent API across all operations
- Less boilerplate code

### 2. Mode Awareness
- Automatic mode switching
- Mode-aware UI components
- Better user experience

### 3. Better Performance
- No unnecessary re-renders
- Optimized data fetching
- Efficient caching

### 4. Future Proof
- Easy to add new features
- Consistent architecture
- Better maintainability

## Testing Migration

### 1. Test Mode Switching
```typescript
// Test that components react to mode changes
const { currentMode } = useUnifiedService();
console.log('Current mode:', currentMode);

// Simulate mode change
window.dispatchEvent(new CustomEvent('modeChange', { 
  detail: { mode: 'offline' } 
}));
```

### 2. Test Data Operations
```typescript
// Test that operations work in both modes
const { createProduct, getProducts } = useUnifiedService();

// Test product creation
const newProduct = await createProduct(productData);
console.log('Product created:', newProduct);

// Test product fetching
const products = await getProducts(storeId);
console.log('Products fetched:', products.length);
```

### 3. Test Error Handling
```typescript
try {
  const result = await createProduct(productData);
} catch (error) {
  console.error('Operation failed:', error);
  // Handle offline mode errors differently
  if (currentMode === 'offline') {
    // Show offline-specific error message
  }
}
```

## Troubleshooting

### Common Issues

1. **"Unified service not initialized" error**
   - Make sure `UnifiedServiceProvider` is wrapping your component
   - Check that the provider is in the component tree

2. **Mode not updating**
   - Verify that mode change events are being dispatched
   - Check that event listeners are properly set up

3. **Data not refreshing on mode change**
   - Include `currentMode` in your query keys
   - Use the unified service methods instead of direct API calls

### Debug Mode
```typescript
// Enable debug logging
const { currentMode, isOnlineMode } = useUnifiedService();
console.log('🔧 Debug:', { currentMode, isOnlineMode });
```

## Next Steps

After migrating your components:

1. **Test thoroughly** in both online and offline modes
2. **Update documentation** to reflect the new approach
3. **Remove old sync hooks** once migration is complete
4. **Add mode-aware features** to improve user experience

## Support

If you encounter issues during migration:

1. Check the `/test-dual-mode` page for working examples
2. Review the unified service implementation
3. Check the browser console for error messages
4. Verify that all providers are properly set up 