-- migrate_v7: Add invoiced tracking to expenses (for invoice import)

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS invoiced   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES documents(id) ON DELETE SET NULL;
