-- Migration: Add barcode support to products table
-- Date: 2024-01-XX
-- Description: Adds barcode field to products table for barcode scanning functionality

-- Add barcode column to products table
ALTER TABLE products 
ADD COLUMN barcode VARCHAR(50) NULL;

-- Create unique index on barcode (allows multiple NULL values)
CREATE UNIQUE INDEX idx_products_barcode_unique 
ON products (barcode) 
WHERE barcode IS NOT NULL;

-- Create regular index for barcode lookups
CREATE INDEX idx_products_barcode_lookup 
ON products (barcode);

-- Add comment to document the field
COMMENT ON COLUMN products.barcode IS 'Product barcode for scanning (EAN-13, UPC-A, Code 128, etc.)';

-- Create function to validate barcode format
CREATE OR REPLACE FUNCTION validate_barcode_format(barcode_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if barcode is NULL (optional field)
  IF barcode_text IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if barcode is empty
  IF LENGTH(TRIM(barcode_text)) = 0 THEN
    RETURN FALSE;
  END IF;
  
  -- EAN-13: 13 digits
  IF barcode_text ~ '^[0-9]{13}$' THEN
    RETURN TRUE;
  END IF;
  
  -- UPC-A: 12 digits
  IF barcode_text ~ '^[0-9]{12}$' THEN
    RETURN TRUE;
  END IF;
  
  -- Code 128: 1-48 alphanumeric characters
  IF barcode_text ~ '^[A-Za-z0-9\-\.\/\+\s]{1,48}$' THEN
    RETURN TRUE;
  END IF;
  
  -- Code 39: 1-43 alphanumeric characters
  IF barcode_text ~ '^[A-Z0-9\-\.\/\+\s]{1,43}$' THEN
    RETURN TRUE;
  END IF;
  
  -- QR Code: variable length (more permissive)
  IF LENGTH(barcode_text) <= 100 THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create constraint to validate barcode format
ALTER TABLE products 
ADD CONSTRAINT check_barcode_format 
CHECK (validate_barcode_format(barcode));

-- Create function to lookup product by barcode
CREATE OR REPLACE FUNCTION get_product_by_barcode(p_barcode TEXT, p_store_id TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  sku TEXT,
  category TEXT,
  cost_price NUMERIC,
  selling_price NUMERIC,
  retail_price NUMERIC,
  wholesale_price NUMERIC,
  wholesale_threshold INTEGER,
  quantity INTEGER,
  unit_of_measure TEXT,
  units_per_pack INTEGER,
  vat_status BOOLEAN,
  input_vat_amount NUMERIC,
  barcode TEXT,
  store_id UUID,
  parent_product_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.category,
    p.cost_price,
    p.selling_price,
    p.retail_price,
    p.wholesale_price,
    p.wholesale_threshold,
    p.quantity,
    p.unit_of_measure,
    p.units_per_pack,
    p.vat_status,
    p.input_vat_amount,
    p.barcode,
    p.store_id,
    p.parent_product_id
  FROM products p
  WHERE p.barcode = p_barcode 
    AND p.store_id = p_store_id::UUID;
END;
$$ LANGUAGE plpgsql;

-- Create function to check barcode uniqueness
CREATE OR REPLACE FUNCTION is_barcode_unique(p_barcode TEXT, p_store_id TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  count_val INTEGER;
BEGIN
  IF p_barcode IS NULL THEN
    RETURN TRUE; -- NULL barcodes are always "unique"
  END IF;
  
  SELECT COUNT(*) INTO count_val
  FROM products
  WHERE barcode = p_barcode 
    AND store_id = p_store_id::UUID
    AND (p_exclude_id IS NULL OR id != p_exclude_id);
  
  RETURN count_val = 0;
END;
$$ LANGUAGE plpgsql;

-- Update the existing create_product function to handle barcode
CREATE OR REPLACE FUNCTION create_product(p_product product_input)
RETURNS products AS $$
DECLARE
  new_product products;
BEGIN
  -- Validate barcode if provided
  IF p_product.barcode IS NOT NULL THEN
    -- Check format
    IF NOT validate_barcode_format(p_product.barcode) THEN
      RAISE EXCEPTION 'Invalid barcode format: %', p_product.barcode;
    END IF;
    
    -- Check uniqueness within store
    IF NOT is_barcode_unique(p_product.barcode, p_product.store_id) THEN
      RAISE EXCEPTION 'Barcode % already exists in this store', p_product.barcode;
    END IF;
  END IF;
  
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
    input_vat_amount,
    barcode
  ) VALUES (
    COALESCE(p_product.id, gen_random_uuid()),
    p_product.name,
    p_product.sku,
    p_product.category,
    p_product.store_id::UUID,
    p_product.quantity,
    p_product.retail_price,
    p_product.wholesale_price,
    p_product.wholesale_threshold,
    p_product.vat_status,
    p_product.cost_price,
    p_product.unit_of_measure,
    p_product.units_per_pack,
    p_product.parent_product_id::UUID,
    p_product.selling_price,
    p_product.input_vat_amount,
    p_product.barcode
  )
  RETURNING * INTO new_product;
  
  RETURN new_product;
END;
$$ LANGUAGE plpgsql;

-- Update the product_input composite type to include barcode
DROP TYPE IF EXISTS product_input CASCADE;
CREATE TYPE product_input AS (
  id UUID,
  name TEXT,
  sku TEXT,
  category TEXT,
  store_id TEXT,
  quantity INTEGER,
  retail_price NUMERIC,
  wholesale_price NUMERIC,
  wholesale_threshold INTEGER,
  vat_status BOOLEAN,
  cost_price NUMERIC,
  unit_of_measure TEXT,
  units_per_pack INTEGER,
  parent_product_id TEXT,
  selling_price NUMERIC,
  input_vat_amount NUMERIC,
  barcode TEXT
);

-- Create API endpoint function for barcode lookup
CREATE OR REPLACE FUNCTION api_get_product_by_barcode(p_barcode TEXT, p_store_id TEXT)
RETURNS JSON AS $$
DECLARE
  product_record RECORD;
  result JSON;
BEGIN
  SELECT * INTO product_record
  FROM get_product_by_barcode(p_barcode, p_store_id)
  LIMIT 1;
  
  IF product_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Product not found',
      'data', null
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Product found',
    'data', row_to_json(product_record)
  );
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_product_by_barcode(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_barcode_unique(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_product_by_barcode(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_barcode_format(TEXT) TO authenticated;

-- Create RLS policies for barcode access
CREATE POLICY "Users can view products by barcode in their store" ON products
  FOR SELECT USING (
    store_id IN (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

-- Add comment to document the migration
COMMENT ON TABLE products IS 'Products table with barcode support for scanning functionality'; 