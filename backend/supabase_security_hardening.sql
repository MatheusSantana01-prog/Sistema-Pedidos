-- Bloqueia acesso direto ao Data API. O Sistema-Pedidos acessa o Supabase
-- exclusivamente pelo backend FastAPI usando a service role.

begin;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

drop policy if exists platform_payments_service_role_all
  on public.platform_payments;
drop policy if exists platform_support_tickets_service_role_all
  on public.platform_support_tickets;
drop policy if exists restaurant_payment_methods_service_role_all
  on public.restaurant_payment_methods;

alter function public.set_restaurant_payment_methods_updated_at()
  set search_path = pg_catalog, public;

commit;
