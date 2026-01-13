-- ============================================
-- Currency Table Schema
-- ============================================
-- Description: Stores currency information with support for base currency designation
-- Language: Persian/Dari names supported
-- ============================================

CREATE TABLE IF NOT EXISTS currencies (
    -- Primary Key
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Currency name in Persian/Dari
    -- Must be unique and cannot be null
    name TEXT NOT NULL UNIQUE,
    
    -- Base currency flag (0 = false, 1 = true)
    -- Only one currency can be marked as base at a time
    -- Used for currency conversion calculations
    base INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamp when the currency was created
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamp when the currency was last updated
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes
-- ============================================
-- Index on name for faster lookups (already covered by UNIQUE constraint)
-- Index on base for faster queries when finding base currency
CREATE INDEX IF NOT EXISTS idx_currencies_base ON currencies(base);

-- ============================================
-- Constraints
-- ============================================
-- UNIQUE constraint on name is already defined in table creation
-- Base currency constraint: Only one currency should be base at a time
-- (This is enforced at application level, not database level)

-- ============================================
-- Example Data
-- ============================================
-- INSERT INTO currencies (name, base) VALUES ('افغانی', 1);
-- INSERT INTO currencies (name, base) VALUES ('دالر', 0);
-- INSERT INTO currencies (name, base) VALUES ('یورو', 0);

-- ============================================
-- Notes
-- ============================================
-- 1. The 'base' field uses INTEGER (0 or 1) to represent boolean values
-- 2. Application logic ensures only one currency has base = 1 at any time
-- 3. Name field supports Persian/Dari characters (UTF-8)
-- 4. Timestamps are automatically managed by SQLite