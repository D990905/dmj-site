-- UI-only Korean notes are never silently translated or included in English exports.
alter table public.ops_supplier_items add column notes_ko text not null default '' check(length(notes_ko)<=1000);
alter table public.ops_supplier_items add column notes_english_confirmed boolean not null default true;
-- Existing English notes, records, permissions, and RLS policies remain intact.
