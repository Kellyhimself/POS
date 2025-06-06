-- Create a function to execute bulk updates
CREATE OR REPLACE FUNCTION execute_bulk_update(p_sql text, p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify store_id exists
  IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'Invalid store_id';
  END IF;

  -- Execute the provided SQL
  EXECUTE p_sql;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_bulk_update TO authenticated;

-- Create a function to get product history
CREATE OR REPLACE FUNCTION get_product_history(p_product_id uuid)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  change_type text,
  old_values jsonb,
  new_values jsonb,
  changed_at timestamptz,
  changed_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ph.id,
    ph.product_id,
    ph.change_type,
    ph.old_values,
    ph.new_values,
    ph.changed_at,
    ph.changed_by
  FROM product_history ph
  WHERE ph.product_id = p_product_id
  ORDER BY ph.changed_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_product_history TO authenticated; 