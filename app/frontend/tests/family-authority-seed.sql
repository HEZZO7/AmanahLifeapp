-- Isolated CI only: pre-migration legacy records, not customer data.
\set ON_ERROR_STOP on
insert into public.app_11941c8fec_families(id,owner_user_id,join_code,name)
values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '22222222-2222-4222-8222-222222222222','LEGACY88','Preserved fixture family');
insert into public.app_11941c8fec_family_expenses
(id,family_id,category,amount,amount_base,created_by)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Food',10,10,
'22222222-2222-4222-8222-222222222222');
