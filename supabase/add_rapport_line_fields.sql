-- Add line_date and line_worker fields to document_lines (for rapport Ausgeführte Arbeiten)
alter table public.document_lines
  add column if not exists line_date text default '',
  add column if not exists line_worker text default '';
