-- migrate_v6.sql: Add bexio-alignment fields

-- contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'firma';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CH';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS uid_nr TEXT DEFAULT '';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS mobile TEXT DEFAULT '';

-- documents (add title)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';

-- document_lines (add discount)
ALTER TABLE public.document_lines ADD COLUMN IF NOT EXISTS discount NUMERIC(5,2) DEFAULT 0;

-- products (add product_type)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'dienstleistung';

-- companies (add address/contact/payment fields)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS zip TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CH';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS iban TEXT DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS uid_nr TEXT DEFAULT '';
