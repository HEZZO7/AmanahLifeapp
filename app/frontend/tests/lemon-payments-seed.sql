-- Before migration #4, fresh isolated fixture only. Synthetic legacy row; no customer data.
\set ON_ERROR_STOP on
do $$ begin
  if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then raise exception 'Isolated fixture required'; end if;
end $$;
insert into auth.users(id,email) values('88888888-8888-4888-8888-888888888888','legacy-fixture@example.invalid');
insert into public.app_11941c8fec_subscriptions(user_id,tier,status,lemonsqueezy_subscription_id)
values('88888888-8888-4888-8888-888888888888','family','active','unverified-legacy-fixture');
