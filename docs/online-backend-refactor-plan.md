# Online Backend Refactor Plan - Maintain Existing UI

## Overview
Refactor the backend logic to support online-only operations while keeping the existing UI code and design intact. This approach minimizes frontend changes and focuses on backend improvements.

## Architecture Strategy

### 1. Create Online Service Layer
```typescript
// src/lib/online/index.ts
export class OnlineService {
  private supabase = createClient();
  
  // Replace offline sync with direct online operations
  async createSale(saleData: SaleInput): Promise<Transaction> {
    // Direct online operation - no offline storage
    const { data, error } = await this.supabase.rpc('create_sale_realtime', {
      p_store_id: saleData.store_id,
      p_user_id: saleData.user_id,
      p_products: saleData.products,
      p_payment_method: saleData.payment_method,
      p_total_amount: saleData.total_amount,
      p_vat_total: saleData.vat_total
    });
    
    if (error) throw error;
    return data;
  }
  
  async updateStock(productId: string, quantityChange: number, version: number): Promise<Product> {
    // Use optimistic locking for conflict prevention
    const { data, error } = await this.supabase.rpc('update_stock_safe', {
      p_product_id: productId,
      p_quantity_change: quantityChange,
      p_expected_version: version,
      p_user_id: getCurrentUserId()
    });
    
    if (error) throw error;
    return data;
  }
  
  async getProducts(storeId: string): Promise<Product[]> {
    // Direct online fetch with real-time subscription
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId);
      
    if (error) throw error;
    return data;
  }
}
```

### 2. Create Online Hooks (Replace Sync Hooks)
```typescript
// src/lib/hooks/useOnlineProducts.ts
export function useOnlineProducts(storeId: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('products')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `store_id=eq.${storeId}`
      }, (payload) => {
        // Update products in real-time
        handleProductChange(payload);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);
  
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const data = await onlineService.getProducts(storeId);
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      const result = await onlineService.updateProduct(productId, updates);
      // Optimistic update handled by real-time subscription
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };
  
  return { products, isLoading, error, fetchProducts, updateProduct };
}

// src/lib/hooks/useOnlineSales.ts
export function useOnlineSales(storeId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const createSale = async (saleData: CreateSaleInput): Promise<Transaction> => {
    try {
      const result = await onlineService.createSale(saleData);
      // Real-time subscription will update transactions automatically
      return result;
    } catch (err) {
      throw err;
    }
  };
  
  return { transactions, createSale };
}
```

### 3. Create Online Database Schema
```sql
-- Add versioning to existing products table
ALTER TABLE products 
ADD COLUMN version INTEGER DEFAULT 1,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN updated_by UUID REFERENCES users(id);

-- Create stock movements table for audit trail
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    transaction_id UUID REFERENCES transactions(id),
    movement_type TEXT NOT NULL,
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id to transactions table
ALTER TABLE transactions 
ADD COLUMN user_id UUID REFERENCES users(id);

-- Create transaction_items table for better structure
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    vat_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Create Online Database Functions
```sql
-- Optimistic locking stock update
CREATE OR REPLACE FUNCTION update_stock_safe(
    p_product_id UUID,
    p_quantity_change INTEGER,
    p_expected_version INTEGER,
    p_user_id UUID
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product products;
    v_old_quantity INTEGER;
BEGIN
    -- Get current product state
    SELECT * INTO v_product 
    FROM products 
    WHERE id = p_product_id;
    
    IF v_product IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;
    
    -- Check version for optimistic locking
    IF v_product.version != p_expected_version THEN
        RAISE EXCEPTION 'Product has been modified by another user. Please refresh and try again.';
    END IF;
    
    v_old_quantity := v_product.quantity;
    
    -- Update product with new version
    UPDATE products
    SET 
        quantity = quantity + p_quantity_change,
        version = version + 1,
        updated_at = NOW(),
        updated_by = p_user_id
    WHERE 
        id = p_product_id 
        AND version = p_expected_version
    RETURNING * INTO v_product;
    
    -- Log stock movement
    INSERT INTO stock_movements (
        product_id,
        transaction_id,
        movement_type,
        quantity_change,
        previous_quantity,
        new_quantity,
        user_id
    ) VALUES (
        p_product_id,
        NULL,
        CASE 
            WHEN p_quantity_change < 0 THEN 'sale'
            WHEN p_quantity_change > 0 THEN 'purchase'
            ELSE 'adjustment'
        END,
        p_quantity_change,
        v_old_quantity,
        v_product.quantity,
        p_user_id
    );
    
    RETURN v_product;
END;
$$;

-- Real-time sale creation
CREATE OR REPLACE FUNCTION create_sale_realtime(
    p_store_id UUID,
    p_user_id UUID,
    p_products JSONB,
    p_payment_method TEXT,
    p_total_amount DECIMAL,
    p_vat_total DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id UUID;
    v_product JSONB;
    v_product_id UUID;
    v_quantity INTEGER;
    v_unit_price DECIMAL;
    v_vat_amount DECIMAL;
    v_product_record products;
BEGIN
    -- Create main transaction record
    INSERT INTO transactions (
        store_id,
        user_id,
        total_amount,
        vat_total,
        payment_method
    ) VALUES (
        p_store_id,
        p_user_id,
        p_total_amount,
        p_vat_total,
        p_payment_method
    ) RETURNING id INTO v_transaction_id;
    
    -- Process each product
    FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
        v_product_id := (v_product->>'id')::UUID;
        v_quantity := (v_product->>'quantity')::INTEGER;
        v_unit_price := (v_product->>'unit_price')::DECIMAL;
        v_vat_amount := (v_product->>'vat_amount')::DECIMAL;
        
        -- Get current product state
        SELECT * INTO v_product_record FROM products WHERE id = v_product_id;
        
        -- Update stock with optimistic locking
        PERFORM update_stock_safe(
            v_product_id,
            -v_quantity,
            v_product_record.version,
            p_user_id
        );
        
        -- Create transaction item
        INSERT INTO transaction_items (
            transaction_id,
            product_id,
            quantity,
            unit_price,
            vat_amount
        ) VALUES (
            v_transaction_id,
            v_product_id,
            v_quantity,
            v_unit_price,
            v_vat_amount
        );
    END LOOP;
    
    RETURN v_transaction_id;
END;
$$;
```

## Implementation Steps

### Step 1: Create Online Service Layer (Week 1)
```typescript
// Create these files:
// - src/lib/online/index.ts (OnlineService class)
// - src/lib/online/products.ts (Product operations)
// - src/lib/online/sales.ts (Sales operations)
// - src/lib/online/transactions.ts (Transaction operations)
```

### Step 2: Create Online Hooks (Week 1-2)
```typescript
// Replace existing sync hooks with online versions:
// - src/lib/hooks/useOnlineProducts.ts (replaces useGlobalProductSync)
// - src/lib/hooks/useOnlineSales.ts (replaces useGlobalSaleSync)
// - src/lib/hooks/useOnlineTransactions.ts (replaces useGlobalSaleSync)
// - src/lib/hooks/useOnlineEtims.ts (replaces useGlobalEtimsSync)
```

### Step 3: Update Database Schema (Week 1)
```sql
-- Run these migrations:
-- 1. Add versioning to products table
-- 2. Create stock_movements table
-- 3. Add user_id to transactions
-- 4. Create transaction_items table
-- 5. Create optimistic locking functions
```

### Step 4: Update Existing Components (Week 2-3)
```typescript
// Minimal changes to existing components:

// 1. Replace hook imports
// Before: import { useGlobalProductSync } from '@/lib/hooks/useGlobalProductSync';
// After:  import { useOnlineProducts } from '@/lib/hooks/useOnlineProducts';

// 2. Update hook usage
// Before: const { isSyncing, lastSyncTime } = useGlobalProductSync();
// After:  const { products, isLoading, error } = useOnlineProducts(storeId);

// 3. Update function calls
// Before: await saveOfflineSale(saleData);
// After:  await createSale(saleData);
```

### Step 5: Add Real-time Subscriptions (Week 2)
```typescript
// Add real-time subscriptions to existing components:
// - Real-time product updates
// - Real-time transaction notifications
// - Real-time stock alerts
```

### Step 6: Add Conflict Resolution (Week 3)
```typescript
// Add conflict resolution UI for optimistic locking failures:
// - Refresh and retry mechanism
// - Conflict notification modal
// - Automatic retry logic
```

## File Structure Changes

### New Files to Create:
```
src/lib/online/
├── index.ts              # Main OnlineService class
├── products.ts           # Product operations
├── sales.ts             # Sales operations
├── transactions.ts      # Transaction operations
└── etims.ts            # eTIMS operations

src/lib/hooks/
├── useOnlineProducts.ts  # Replace useGlobalProductSync
├── useOnlineSales.ts     # Replace useGlobalSaleSync
├── useOnlineTransactions.ts
└── useOnlineEtims.ts     # Replace useGlobalEtimsSync

src/components/
├── ConflictResolutionModal.tsx
└── RealtimeNotifications.tsx
```

### Files to Modify (Minimal Changes):
```
src/app/layout.tsx
├── Replace sync hook imports with online hooks
└── Remove offline sync logic

src/app/pos/page.tsx
├── Replace useGlobalSaleSync with useOnlineSales
└── Update sale creation logic

src/app/inventory/page.tsx
├── Replace useGlobalProductSync with useOnlineProducts
└── Update product operations

src/components/providers/AuthProvider.tsx
├── Add online/offline mode detection
└── Add user session management
```

## Migration Strategy

### Phase 1: Parallel Development (Week 1-2)
1. Create online backend layer alongside existing offline system
2. Test online functions independently
3. Ensure database schema changes are backward compatible

### Phase 2: Component Migration (Week 2-3)
1. Migrate one component at a time (start with POS)
2. Test each component thoroughly
3. Keep offline version as fallback

### Phase 3: Full Migration (Week 3-4)
1. Migrate all components to online hooks
2. Remove offline sync logic
3. Add real-time features

### Phase 4: Testing & Deployment (Week 4)
1. Multi-device testing
2. Performance testing
3. User acceptance testing
4. Production deployment

## Benefits of This Approach

### 1. Minimal UI Changes
- Keep existing components and design
- Only change backend logic and data flow
- Maintain user experience consistency

### 2. Gradual Migration
- Migrate components one by one
- Test thoroughly at each step
- Rollback capability if issues arise

### 3. Reduced Development Time
- No need to rebuild UI components
- Focus on backend improvements
- Leverage existing codebase

### 4. Better Maintainability
- Clean separation of concerns
- Online logic isolated from offline logic
- Easier to debug and maintain

## Cost and Timeline

### Development Time: 4-5 weeks
- **Week 1**: Online service layer and database schema
- **Week 2**: Online hooks and real-time subscriptions
- **Week 3**: Component migration and conflict resolution
- **Week 4**: Testing and deployment

### Infrastructure Costs: ~$45/month
- **Supabase Pro**: $25/month (real-time features)
- **Vercel Pro**: $20/month (better performance)

### Benefits:
- **Eliminates sync conflicts**: Priceless for business operations
- **Real-time multi-device support**: Enables true scalability
- **Maintains existing UI**: No user retraining needed
- **Faster development**: Leverage existing codebase

## Conclusion

This **backend-only refactoring approach** is the optimal solution because:

1. **Minimizes risk**: Keep existing UI that's already tested and working
2. **Faster development**: Focus on backend improvements only
3. **Better user experience**: No UI changes mean no user retraining
4. **Easier maintenance**: Clean separation between online and offline logic
5. **Gradual migration**: Can migrate components one by one

The investment in this approach will give you a robust online system while maintaining your existing UI investment and user experience. 