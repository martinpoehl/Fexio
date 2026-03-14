-- LocalFinance Supabase Schema
-- Schweizer KMU Business Software
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ═══════════════════════════════════════
-- COMPANY SETTINGS (per user)
-- ═══════════════════════════════════════
create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Meine Firma AG',
  address text default '',
  zip text default '',
  city text default '',
  email text default '',
  phone text default '',
  iban text default '',
  uid_nr text default '',
  mwst_rate numeric(5,2) default 8.1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- CONTACTS
-- ═══════════════════════════════════════
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  firm text default '',
  email text default '',
  phone text default '',
  address text default '',
  zip text default '',
  city text default '',
  type text default 'kunde' check (type in ('kunde', 'lieferant')),
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- PRODUCTS
-- ═══════════════════════════════════════
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  article_nr text default '',
  name text not null,
  description text default '',
  price numeric(12,2) default 0,
  unit text default 'Stk.',
  tax_rate numeric(5,2) default 8.1,
  active boolean default true,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- PROJECTS
-- ═══════════════════════════════════════
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  hourly_rate numeric(10,2) default 120,
  budget numeric(12,2) default 0,
  status text default 'aktiv' check (status in ('aktiv', 'abgeschlossen')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- DOCUMENTS (Offerten, Aufträge, Rechnungen)
-- ═══════════════════════════════════════
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  type text not null check (type in ('offer', 'order', 'invoice')),
  number text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  contact_name text default '',
  date date default current_date,
  due_date date,
  status text default 'entwurf' check (status in ('entwurf', 'offen', 'versendet', 'angenommen', 'bezahlt', 'teilweise_bezahlt', 'abgelehnt', 'storniert')),
  subtotal numeric(12,2) default 0,
  tax_amount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  notes text default '',
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- DOCUMENT LINES (Positionen)
-- ═══════════════════════════════════════
create table public.document_lines (
  id uuid default uuid_generate_v4() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  position integer default 0,
  description text not null,
  quantity numeric(10,3) default 1,
  unit text default 'Stk.',
  unit_price numeric(12,2) default 0,
  tax_rate numeric(5,2) default 8.1,
  total numeric(12,2) default 0,
  product_id uuid references public.products(id) on delete set null
);

-- ═══════════════════════════════════════
-- TIME ENTRIES (Zeiterfassung)
-- ═══════════════════════════════════════
create table public.time_entries (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  description text not null,
  date date default current_date,
  duration_minutes integer default 0,
  start_time time,
  end_time time,
  project_id uuid references public.projects(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  billable boolean default true,
  hourly_rate numeric(10,2) default 0,
  invoiced boolean default false,
  invoice_id uuid references public.documents(id) on delete set null,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- EXPENSES (Aufwendungen)
-- ═══════════════════════════════════════
create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  description text not null,
  amount numeric(12,2) default 0,
  date date default current_date,
  category text default 'Sonstige',
  vendor text default '',
  account_nr text default '6700',
  receipt_url text default '',
  notes text default '',
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- JOURNAL (Buchhaltung)
-- ═══════════════════════════════════════
create table public.journal_entries (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  date date not null,
  debit_account text not null,
  credit_account text not null,
  amount numeric(12,2) not null,
  description text not null,
  reference text default '',
  document_id uuid references public.documents(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  auto_generated boolean default true,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- BANK TRANSACTIONS (camt.053 Import)
-- ═══════════════════════════════════════
create table public.bank_transactions (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  date date not null,
  amount numeric(12,2) not null,
  currency text default 'CHF',
  description text default '',
  debtor_name text default '',
  creditor_name text default '',
  reference text default '',
  iban text default '',
  matched boolean default false,
  document_id uuid references public.documents(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  imported_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.products enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.document_lines enable row level security;
alter table public.time_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.journal_entries enable row level security;
alter table public.bank_transactions enable row level security;

-- Company: user owns their company
create policy "Users can manage their company"
  on public.companies for all
  using (auth.uid() = user_id);

-- Helper function: get company_id for current user
create or replace function public.get_my_company_id()
returns uuid as $$
  select id from public.companies where user_id = auth.uid() limit 1;
$$ language sql security definer;

-- All other tables: user can access rows belonging to their company
create policy "Company access" on public.contacts for all
  using (company_id = public.get_my_company_id());

create policy "Company access" on public.products for all
  using (company_id = public.get_my_company_id());

create policy "Company access" on public.projects for all
  using (company_id = public.get_my_company_id());

create policy "Company access" on public.documents for all
  using (company_id = public.get_my_company_id());

create policy "Company access" on public.document_lines for all
  using (document_id in (select id from public.documents where company_id = public.get_my_company_id()));

create policy "Company access" on public.time_entries for all
  using (company_id = public.get_my_company_id());

create policy "Company access" on public.expenses for all
  using (company_id = public.get_my_company_id());

create policy "Company access" on public.journal_entries for all
  using (company_id = public.get_my_company_id());

create policy "Company access" on public.bank_transactions for all
  using (company_id = public.get_my_company_id());

-- ═══════════════════════════════════════
-- AUTO-CREATE COMPANY ON SIGNUP
-- ═══════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.companies (user_id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Meine Firma'), new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════
create index idx_contacts_company on public.contacts(company_id);
create index idx_documents_company on public.documents(company_id);
create index idx_documents_type on public.documents(company_id, type);
create index idx_document_lines_doc on public.document_lines(document_id);
create index idx_time_entries_company on public.time_entries(company_id);
create index idx_time_entries_project on public.time_entries(project_id);
create index idx_expenses_company on public.expenses(company_id);
create index idx_journal_company on public.journal_entries(company_id);
create index idx_bank_tx_company on public.bank_transactions(company_id);

-- ═══════════════════════════════════════
-- USEFUL VIEWS
-- ═══════════════════════════════════════

-- Revenue summary by month
create or replace view public.monthly_revenue as
select
  company_id,
  date_trunc('month', date) as month,
  sum(case when status = 'bezahlt' then total else 0 end) as revenue,
  sum(case when status in ('offen', 'versendet') then total else 0 end) as outstanding,
  count(*) as invoice_count
from public.documents
where type = 'invoice'
group by company_id, date_trunc('month', date);

-- Time summary by project
create or replace view public.project_time_summary as
select
  t.company_id,
  t.project_id,
  p.name as project_name,
  p.budget,
  p.hourly_rate,
  sum(t.duration_minutes) as total_minutes,
  sum(case when t.billable then t.duration_minutes else 0 end) as billable_minutes,
  sum(case when t.billable then (t.duration_minutes::numeric / 60) * t.hourly_rate else 0 end) as billable_amount,
  count(*) as entry_count
from public.time_entries t
left join public.projects p on p.id = t.project_id
group by t.company_id, t.project_id, p.name, p.budget, p.hourly_rate;
