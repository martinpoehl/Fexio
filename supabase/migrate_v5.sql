-- migrate_v5.sql
-- Create bank_transactions table for bank import & reconciliation

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'CHF',
  description   TEXT,
  debtor_name   TEXT,
  is_credit     BOOLEAN NOT NULL DEFAULT TRUE,
  matched       BOOLEAN NOT NULL DEFAULT FALSE,
  document_id   UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bank_transactions"
  ON public.bank_transactions
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );
