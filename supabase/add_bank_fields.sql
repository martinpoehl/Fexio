-- Add bank_name and bic fields to companies table
alter table public.companies
  add column if not exists bank_name text default '',
  add column if not exists bic text default '';
