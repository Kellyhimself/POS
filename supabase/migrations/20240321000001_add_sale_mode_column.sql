-- Add sale_mode column to sale_items table
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS sale_mode TEXT DEFAULT 'retail';

-- Add check constraint to ensure sale_mode is either 'retail' or 'wholesale'
ALTER TABLE sale_items
ADD CONSTRAINT sale_mode_check 
CHECK (sale_mode IN ('retail', 'wholesale')); 