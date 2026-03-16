-- migrate_v4.sql
-- Add stock_qty (Lagerbestand) to products table

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_qty INTEGER NOT NULL DEFAULT 0;
