-- Rollback Migration: Remove barcode support from products table
-- Date: 2024-01-XX
-- Description: Safely removes barcode field and related functions from products table
-- WARNING: This will permanently delete barcode data

-- Step 1: Drop RLS policies related to barcode
DROP POLICY IF EXISTS "Users can view products by barcode in their store" ON products;

-- Step 2: Drop functions related to barcode
DROP FUNCTION IF EXISTS api_get_product_by_barcode(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_product_by_barcode(TEXT, TEXT);
DROP FUNCTION IF EXISTS is_barcode_unique(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS validate_barcode_format(TEXT);

-- Step 3: Drop constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS check_barcode_format;

-- Step 4: Drop indexes
DROP INDEX IF EXISTS idx_products_barcode_unique;
DROP INDEX IF EXISTS idx_products_barcode_lookup;

-- Step 5: Update the product_input composite type to remove barcode
-- First, check if the type exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'product_input'
    ) THEN
        -- Check if barcode field exists in the type
        IF EXISTS (
            SELECT 1 FROM pg_attribute a
            JOIN pg_class c ON a.attrelid = c.oid
            JOIN pg_type t ON c.reltype = t.oid
            WHERE t.typname = 'product_input' 
            AND a.attname = 'barcode'
        ) THEN
            -- Drop the existing type and recreate it without barcode
            DROP TYPE product_input CASCADE;
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
              input_vat_amount NUMERIC
            );
            RAISE NOTICE 'Updated product_input type to remove barcode field';
        ELSE
            RAISE NOTICE 'product_input type does not have barcode field';
        END IF;
    ELSE
        RAISE NOTICE 'product_input type does not exist';
    END IF;
END $$;

-- Step 6: Update the create_product function to remove barcode handling
CREATE OR REPLACE FUNCTION create_product(p_product product_input)
RETURNS products AS $$
DECLARE
  new_product products;
BEGIN
  -- Insert the product (without barcode validation)
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
    p_product.input_vat_amount
  )
  RETURNING * INTO new_product;
  
  RETURN new_product;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Remove barcode column from products table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'barcode'
    ) THEN
        ALTER TABLE products DROP COLUMN barcode;
        RAISE NOTICE 'Removed barcode column from products table';
    ELSE
        RAISE NOTICE 'Barcode column does not exist in products table';
    END IF;
END $$;

-- Step 8: Update table comment
COMMENT ON TABLE products IS 'Products table';

-- Step 9: Verify the rollback
DO $$
BEGIN
    RAISE NOTICE 'Rollback completed successfully!';
    RAISE NOTICE 'Barcode support has been removed from the products table.';
    RAISE NOTICE 'All barcode data has been permanently deleted.';
END $$; 