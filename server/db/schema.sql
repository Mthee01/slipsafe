-- SlipSafe Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash TEXT NOT NULL UNIQUE,
  merchant TEXT NOT NULL,
  date DATE NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  returnBy DATE,
  warrantyEnds DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_purchases_hash ON purchases(hash);

-- Create index on dates for deadline queries
CREATE INDEX IF NOT EXISTS idx_purchases_returnBy ON purchases(returnBy);
CREATE INDEX IF NOT EXISTS idx_purchases_warrantyEnds ON purchases(warrantyEnds);

-- TODO: Add Row Level Security (RLS) policies for multi-user support
-- For now, leaving RLS disabled for MVP testing
-- Uncomment and configure these policies when adding authentication:

-- Enable RLS
-- ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own purchases
-- CREATE POLICY "Users can view own purchases" ON purchases
--   FOR SELECT
--   USING (auth.uid() = user_id);

-- Policy: Users can insert their own purchases  
-- CREATE POLICY "Users can insert own purchases" ON purchases
--   FOR INSERT
--   WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own purchases
-- CREATE POLICY "Users can update own purchases" ON purchases
--   FOR UPDATE
--   USING (auth.uid() = user_id);

-- Policy: Users can delete their own purchases
-- CREATE POLICY "Users can delete own purchases" ON purchases
--   FOR DELETE
--   USING (auth.uid() = user_id);

-- Note: When implementing RLS, add a user_id column:
-- ALTER TABLE purchases ADD COLUMN user_id UUID REFERENCES auth.users(id);
-- CREATE INDEX idx_purchases_user_id ON purchases(user_id);

-- Sample query to verify table creation
-- SELECT * FROM purchases LIMIT 10;
