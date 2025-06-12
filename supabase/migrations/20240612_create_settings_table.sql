-- Create settings table
CREATE TABLE IF NOT EXISTS store_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    low_stock_threshold INTEGER DEFAULT 10,
    enable_offline_mode BOOLEAN DEFAULT true,
    enable_vat BOOLEAN DEFAULT true,
    vat_rate DECIMAL(5,2) DEFAULT 16.00,
    enable_etims BOOLEAN DEFAULT true,
    enable_mpesa BOOLEAN DEFAULT true,
    mpesa_paybill TEXT,
    mpesa_till_number TEXT,
    enable_notifications BOOLEAN DEFAULT true,
    enable_auto_sync BOOLEAN DEFAULT true,
    sync_interval INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(store_id)
);

-- Create RLS policies
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view their settings"
    ON store_settings FOR SELECT
    USING (store_id IN (
        SELECT store_id FROM store_users
        WHERE user_id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "Store owners can update their settings"
    ON store_settings FOR UPDATE
    USING (store_id IN (
        SELECT store_id FROM store_users
        WHERE user_id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "Store owners can insert their settings"
    ON store_settings FOR INSERT
    WITH CHECK (store_id IN (
        SELECT store_id FROM store_users
        WHERE user_id = auth.uid() AND role = 'owner'
    ));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_store_settings_updated_at
    BEFORE UPDATE ON store_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 