-- Add cost protection and receipt settings columns to app_settings table
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS cost_protection_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cost_protection_admin_approval BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cost_protection_allow_below_cost BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cost_protection_min_margin NUMERIC(5,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS cost_protection_show_warnings BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cost_protection_auto_calculate BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receipt_auto_print BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS receipt_auto_download BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS receipt_download_format TEXT DEFAULT 'pdf' CHECK (receipt_download_format IN ('pdf', 'txt', 'both')),
ADD COLUMN IF NOT EXISTS receipt_print_delay INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS receipt_download_delay INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS receipt_show_inline BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receipt_auto_close BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS receipt_close_delay INTEGER DEFAULT 3000;

-- Update existing records with default values
UPDATE public.app_settings 
SET 
  cost_protection_enabled = COALESCE(cost_protection_enabled, true),
  cost_protection_admin_approval = COALESCE(cost_protection_admin_approval, true),
  cost_protection_allow_below_cost = COALESCE(cost_protection_allow_below_cost, false),
  cost_protection_min_margin = COALESCE(cost_protection_min_margin, 5.00),
  cost_protection_show_warnings = COALESCE(cost_protection_show_warnings, true),
  cost_protection_auto_calculate = COALESCE(cost_protection_auto_calculate, true),
  receipt_auto_print = COALESCE(receipt_auto_print, false),
  receipt_auto_download = COALESCE(receipt_auto_download, false),
  receipt_download_format = COALESCE(receipt_download_format, 'pdf'),
  receipt_print_delay = COALESCE(receipt_print_delay, 1000),
  receipt_download_delay = COALESCE(receipt_download_delay, 1000),
  receipt_show_inline = COALESCE(receipt_show_inline, true),
  receipt_auto_close = COALESCE(receipt_auto_close, false),
  receipt_close_delay = COALESCE(receipt_close_delay, 3000)
WHERE id = 'global'; 