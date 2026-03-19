alter table public.contacts
  add column if not exists customer_number text default '';
