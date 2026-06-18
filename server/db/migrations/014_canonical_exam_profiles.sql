-- Deduplicate exam profiles. The short-name rows ("AMC", "ACRRM") duplicated the
-- canonical ones ("AMC Clinical", "StAMPS (ACRRM)"); cases tagged with the short
-- names now match the canonical profiles via aliases in the backend.
delete from public.exam_profiles where exam_key in ('AMC', 'ACRRM', 'RACGP', 'CCE', 'STAMPS');

-- Ensure the full canonical set exists (KFP has ~96 cases; AKT for completeness).
insert into public.exam_profiles (exam_key, label, examiner_instructions, mode, sort) values
('KFP', 'KFP (RACGP)',
 'You are running the RACGP KFP (Key Feature Problems): short written-style clinical scenarios testing decision-making and prioritisation. Probe the candidate''s reasoning and the key features of safe management.',
 'both', 5),
('AKT', 'AKT (RACGP)',
 'You are running the RACGP AKT (Applied Knowledge Test) style: applied clinical knowledge across general practice. Probe the reasoning behind the candidate''s answers.',
 'both', 6)
on conflict (exam_key) do nothing;
