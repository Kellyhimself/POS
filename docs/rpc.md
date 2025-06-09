-- Drop existing functions and types if they exist
DROP FUNCTION IF EXISTS create_product(product_input);
DROP FUNCTION IF EXISTS create_products_batch(product_input[]);
DROP FUNCTION IF EXISTS update_stock(UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS update_stock_batch(stock_update_input[]);
DROP TYPE IF EXISTS product_input;
DROP TYPE IF EXISTS stock_update_input;

-- Drop existing functions and types if they exist
DROP FUNCTION IF EXISTS create_product(product_input);
DROP FUNCTION IF EXISTS create_products_batch(product_input[]);
DROP TYPE IF EXISTS product_input;

-- Create type for product input with input_vat_amount
CREATE TYPE product_input AS (
    id UUID,
    name TEXT,
    sku TEXT,
    category TEXT,
    store_id UUID,
    quantity INTEGER,
    retail_price DECIMAL,
    wholesale_price DECIMAL,
    wholesale_threshold INTEGER,
    vat_status BOOLEAN,
    cost_price DECIMAL,
    unit_of_measure TEXT,
    units_per_pack INTEGER,
    parent_product_id UUID,
    selling_price DECIMAL,
    input_vat_amount DECIMAL
);

-- Function to create a single product
CREATE OR REPLACE FUNCTION create_product(p_product product_input)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product products;
BEGIN
    -- Insert the product
    INSERT INTO products (
        id,
        name,
        sku,
        category,
        store_id,
        quantity,
        retail_price,
        wholesale_price,
        wholesale_threshold,
        vat_status,
        cost_price,
        unit_of_measure,
        units_per_pack,
        parent_product_id,
        selling_price,
        input_vat_amount
    ) VALUES (
        COALESCE(p_product.id, gen_random_uuid()),
        p_product.name,
        p_product.sku,
        p_product.category,
        p_product.store_id,
        COALESCE(p_product.quantity, 0),
        p_product.retail_price,
        p_product.wholesale_price,
        p_product.wholesale_threshold,
        COALESCE(p_product.vat_status, false),
        COALESCE(p_product.cost_price, 0),
        COALESCE(p_product.unit_of_measure, 'unit'),
        COALESCE(p_product.units_per_pack, 1),
        p_product.parent_product_id,
        COALESCE(p_product.selling_price, p_product.retail_price),
        COALESCE(p_product.input_vat_amount, 0)
    )
    RETURNING * INTO v_product;

    RETURN v_product;
END;
$$;

-- Function to create multiple products in batch
CREATE OR REPLACE FUNCTION create_products_batch(p_products product_input[])
RETURNS SETOF products
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product product_input;
BEGIN
    -- Start a transaction
    BEGIN
        -- Loop through each product and insert
        FOREACH v_product IN ARRAY p_products
        LOOP
            -- Insert the product using the single product function
            RETURN QUERY SELECT * FROM create_product(v_product);
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback the transaction on error
            RAISE EXCEPTION 'Error in batch product creation: %', SQLERRM;
    END;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_product(product_input) TO authenticated;
GRANT EXECUTE ON FUNCTION create_products_batch(product_input[]) TO authenticated;
-- Function to update stock for a single product
CREATE OR REPLACE FUNCTION update_stock(
    p_product_id UUID,
    p_quantity_change INTEGER,
    p_store_id UUID DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product products;
BEGIN
    -- Update the product's quantity
    UPDATE products
    SET 
        quantity = quantity + p_quantity_change,
        updated_at = NOW()
    WHERE 
        id = p_product_id
        AND (p_store_id IS NULL OR store_id = p_store_id)
    RETURNING * INTO v_product;

    -- Check if the product was found and updated
    IF v_product IS NULL THEN
        RAISE EXCEPTION 'Product not found or store_id mismatch';
    END IF;

    RETURN v_product;
END;
$$;

-- Function to update stock for multiple products in batch
CREATE OR REPLACE FUNCTION update_stock_batch(p_updates stock_update_input[])
RETURNS SETOF products
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_update stock_update_input;
BEGIN
    -- Start a transaction
    BEGIN
        -- Loop through each update and apply it
        FOREACH v_update IN ARRAY p_updates
        LOOP
            -- Update the stock using the single update function
            RETURN QUERY SELECT * FROM update_stock(
                v_update.product_id,
                v_update.quantity_change
            );
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback the transaction on error
            RAISE EXCEPTION 'Error in batch stock update: %', SQLERRM;
    END;
END;
$$;


-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_product(product_input) TO authenticated;
GRANT EXECUTE ON FUNCTION create_products_batch(product_input[]) TO authenticated;
GRANT EXECUTE ON FUNCTION update_stock(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_stock_batch(stock_update_input[]) TO authenticated;

CREATE OR REPLACE FUNCTION create_sale(
  p_store_id UUID,
  p_products JSONB,
  p_payment_method TEXT,
  p_total_amount NUMERIC,
  p_vat_total NUMERIC,
  p_is_sync BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_first_transaction_id UUID;
  v_product JSONB;
  v_total DECIMAL;
  v_product_id UUID;
  v_quantity INTEGER;
  v_display_price DECIMAL;
  v_vat_amount DECIMAL;
BEGIN
  -- Start transaction
  BEGIN
    -- Process each product and update stock
    FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
      -- Extract values from JSON, try both id and product_id fields
      v_product_id := COALESCE(
        (v_product->>'id')::UUID,
        (v_product->>'product_id')::UUID
      );
      v_quantity := (v_product->>'quantity')::INTEGER;
      v_display_price := (v_product->>'displayPrice')::DECIMAL;
      v_vat_amount := (v_product->>'vat_amount')::DECIMAL;
      
      -- Validate required fields
      IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'Product ID is required';
      END IF;
      
      IF v_quantity IS NULL THEN
        RAISE EXCEPTION 'Quantity is required';
      END IF;
      
      IF v_display_price IS NULL THEN
        RAISE EXCEPTION 'Display price is required';
      END IF;
      
      IF v_vat_amount IS NULL THEN
        RAISE EXCEPTION 'VAT amount is required';
      END IF;
      
      -- Calculate total for this product
      v_total := v_display_price * v_quantity;

      -- Create transaction item
      INSERT INTO transactions (
        store_id,
        product_id,
        quantity,
        total,
        vat_amount,
        payment_method,
        timestamp,
        synced
      )
      VALUES (
        p_store_id,
        v_product_id,
        v_quantity,
        v_total,
        v_vat_amount,
        p_payment_method,
        CURRENT_TIMESTAMP,
        TRUE
      )
      RETURNING id INTO v_first_transaction_id;

      -- Only update stock for online sales (non-sync operations)
      IF NOT p_is_sync THEN
        -- For direct online sales, use the reduction operation
        PERFORM update_stock(
          v_product_id,
          -v_quantity,
          p_store_id
        );
      END IF;
    END LOOP;

    RETURN v_first_transaction_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback will happen automatically
      RAISE;
  END;
END;
$$;