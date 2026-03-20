-- migrate_v10: Add reference field to documents

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT '';
