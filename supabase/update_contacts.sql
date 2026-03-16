ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Move data from name to first_name/last_name (simplistic split)
UPDATE public.contacts SET 
  first_name = split_part(name, ' ', 1),
  last_name = substr(name, length(split_part(name, ' ', 1)) + 2)
WHERE name IS NOT NULL AND first_name IS NULL AND last_name IS NULL;

ALTER TABLE public.contacts ALTER COLUMN name DROP NOT NULL;
-- We keep the 'name' column for now or drop it later if we want to be clean
-- For this task, we will replace logic to use first_name/last_name

