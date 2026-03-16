-- Migration v2: Add missing columns, fix trigger, setup logo storage
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

-- 3. Create missing company rows for existing users (who registered before trigger was set up)
INSERT INTO public.companies (user_id, name, email)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'company', ''),
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    split_part(u.email, '@', 1),
    'Meine Firma'
  ),
  u.email
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c WHERE c.user_id = u.id
);

-- 4. Fix handle_new_user trigger: use 'company' metadata for company name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.companies (user_id, name, email)
  VALUES (
    new.id,
    COALESCE(
      NULLIF(new.raw_user_meta_data->>'company', ''),
      NULLIF(new.raw_user_meta_data->>'full_name', ''),
      'Meine Firma'
    ),
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Storage policies (drop old ones first to avoid conflicts)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;
DROP POLICY IF EXISTS "Owner Update" ON storage.objects;

CREATE POLICY "Logos Public Read" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "Logos Authenticated Upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Logos Owner Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND owner = auth.uid());

CREATE POLICY "Logos Owner Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND owner = auth.uid());
