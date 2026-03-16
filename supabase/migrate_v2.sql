-- Migration v2: Add missing columns and fix trigger
-- Run this in Supabase SQL Editor

-- 1. Add logo_url to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';

-- 2. Add first_name / last_name to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT '';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT '';

-- Move existing name data to first_name/last_name
UPDATE public.contacts SET
  first_name = split_part(name, ' ', 1),
  last_name = substr(name, length(split_part(name, ' ', 1)) + 2)
WHERE name IS NOT NULL AND name != '' AND first_name = '';

ALTER TABLE public.contacts ALTER COLUMN name DROP NOT NULL;

-- 3. Fix handle_new_user trigger: use 'company' metadata for company name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.companies (user_id, name, email)
  VALUES (
    new.id,
    COALESCE(
      NULLIF(new.raw_user_meta_data->>'company', ''),
      new.raw_user_meta_data->>'full_name',
      'Meine Firma'
    ),
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Storage for logos (if not already created)
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access'
  ) THEN
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated Upload'
  ) THEN
    CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
  END IF;
END $$;
