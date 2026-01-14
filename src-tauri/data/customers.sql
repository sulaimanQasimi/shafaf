-- ============================================
-- Customer Table Schema
-- ============================================
-- Description: Stores customer information with contact details
-- Language: Persian/Dari names supported
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
    -- Primary Key
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Customer full name
    -- Must be provided and cannot be null
    full_name TEXT NOT NULL,
    
    -- Phone number
    -- Must be provided and cannot be null
    phone TEXT NOT NULL,
    
    -- Address
    -- Must be provided and cannot be null
    address TEXT NOT NULL,
    
    -- Email address (optional)
    email TEXT,
    
    -- Additional notes (optional)
    notes TEXT,
    
    -- Timestamp when the customer was created
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamp when the customer was last updated
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes
-- ============================================
-- Index on full_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_full_name ON customers(full_name);

-- Index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ============================================
-- Constraints
-- ============================================
-- Required fields: full_name, phone, address
-- Optional fields: email, notes

-- ============================================
-- Example Data
-- ============================================
-- INSERT INTO customers (full_name, phone, address, email, notes) 
-- VALUES ('احمد محمدی', '0791234567', 'کابل، افغانستان', 'ahmad@example.com', 'مشتری دائمی');

-- ============================================
-- Notes
-- ============================================
-- This table stores customer information for the pharmacy management system.
-- All customers must have at least full_name, phone, and address.
-- Email and notes are optional fields for additional information.
