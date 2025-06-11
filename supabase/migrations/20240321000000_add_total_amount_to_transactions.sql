-- Add total_amount column to transactions table
ALTER TABLE transactions
ADD COLUMN total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Add comment to the column
COMMENT ON COLUMN transactions.total_amount IS 'The total amount of the transaction'; 