ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'logos' AND (select auth.uid()) = owner);
