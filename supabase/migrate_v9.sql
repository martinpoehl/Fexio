-- migrate_v9: Add service_period to documents

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS service_period TEXT DEFAULT '';
