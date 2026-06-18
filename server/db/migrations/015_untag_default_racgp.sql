-- The importer used to DEFAULT unlabeled cases to exam_type='RACGP', which made
-- them falsely appear as RACGP CCE. None of these titles actually say RACGP, so
-- clear the wrong tag — PassGP will assign the correct exam explicitly.
update public.exam_questions
set exam_type = 'Unassigned'
where exam_type = 'RACGP' and title not ilike '%racgp%';
