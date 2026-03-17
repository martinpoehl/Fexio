-- migrate_v8: Add default hourly rate to companies

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS default_hourly_rate NUMERIC(10,2) DEFAULT 0;
