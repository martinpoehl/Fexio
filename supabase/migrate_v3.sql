-- Migration v3: Add receipt_url to expenses, setup receipts storage bucket
-- Run this in Supabase SQL Editor

-- 1. Add receipt_url column to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT DEFAULT '';

-- 2. Create receipts storage bucket (public so URLs work without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Storage policies for receipts bucket
CREATE POLICY "Receipts Public Read" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');

CREATE POLICY "Receipts Authenticated Upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Receipts Owner Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND owner = auth.uid());

CREATE POLICY "Receipts Owner Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND owner = auth.uid());
