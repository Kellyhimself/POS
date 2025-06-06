-- Create etims_submissions table
CREATE TABLE IF NOT EXISTS etims_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    response_data JSONB,
    error_message TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_etims_submissions_store_id ON etims_submissions(store_id);
CREATE INDEX IF NOT EXISTS idx_etims_submissions_invoice_number ON etims_submissions(invoice_number);

-- Add RLS policies
ALTER TABLE etims_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store users can view their store's eTIMS submissions"
    ON etims_submissions
    FOR SELECT
    USING (
        store_id IN (
            SELECT store_id FROM users
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Store users can insert their store's eTIMS submissions"
    ON etims_submissions
    FOR INSERT
    WITH CHECK (
        store_id IN (
            SELECT store_id FROM users
            WHERE id = auth.uid()
        )
    ); 