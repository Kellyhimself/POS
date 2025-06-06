-- Function to get stock level
CREATE OR REPLACE FUNCTION get_stock_level(
  p_product_id UUID,
  p_store_id UUID
)
RETURNS TABLE (
  quantity INTEGER,
  units_per_pack INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.quantity,
    p.units_per_pack
  FROM products p
  WHERE p.id = p_product_id
    AND p.store_id = p_store_id;
END;
$$;

-- Function to update stock
CREATE OR REPLACE FUNCTION update_stock(
  p_product_id UUID,
  p_quantity_change INTEGER,
  p_store_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock INTEGER;
BEGIN
  -- Get current stock
  SELECT quantity INTO v_current_stock
  FROM products
  WHERE id = p_product_id
    AND store_id = p_store_id;

  -- Check if we have enough stock
  IF v_current_stock + p_quantity_change < 0 THEN
    RETURN FALSE;
  END IF;

  -- Update stock
  UPDATE products
  SET quantity = quantity + p_quantity_change
  WHERE id = p_product_id
    AND store_id = p_store_id;

  RETURN TRUE;
END;
$$;

-- Function to create a sale
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
  v_sale_id UUID;
  v_product JSONB;
BEGIN
  -- Start transaction
  BEGIN
    -- Create sale record
    INSERT INTO sales (
      store_id,
      payment_method,
      total_amount,
      vat_total
    )
    VALUES (
      p_store_id,
      p_payment_method,
      p_total_amount,
      p_vat_total
    )
    RETURNING id INTO v_sale_id;

    -- Create sale items and update stock
    FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
      -- Create sale item
      INSERT INTO sale_items (
        sale_id,
        product_id,
        quantity,
        price,
        vat_amount
      )
      VALUES (
        v_sale_id,
        (v_product->>'product_id')::UUID,
        (v_product->>'quantity')::INTEGER,
        (v_product->>'price')::DECIMAL,
        (v_product->>'vat_amount')::DECIMAL
      );

      -- Update stock
      PERFORM update_stock(
        (v_product->>'product_id')::UUID,
        -(v_product->>'quantity')::INTEGER,
        p_store_id
      );
    END LOOP;

    RETURN v_sale_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback will happen automatically
      RAISE;
  END;
END;
$$; 