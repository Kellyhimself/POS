-- Drop the old function if it exists
DROP FUNCTION IF EXISTS public.create_sale;

-- Create the new function that handles multiple products
CREATE OR REPLACE FUNCTION create_sale(
  p_store_id UUID,
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
        FALSE
      )
      RETURNING id INTO v_first_transaction_id;

      -- Update stock
      PERFORM update_stock(
        v_product_id,
        -v_quantity,
        p_store_id
      );
    END LOOP;

    RETURN v_first_transaction_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback will happen automatically
      RAISE;
  END;
END;
$$; 