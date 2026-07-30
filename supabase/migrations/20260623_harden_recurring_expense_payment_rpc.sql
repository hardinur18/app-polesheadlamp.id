begin;

revoke execute on function public.pay_recurring_expense(
  text, text, date, date, numeric, text, text, text, text, text, text, text, text, text, text
) from public;

revoke execute on function public.pay_recurring_expense(
  text, text, date, date, numeric, text, text, text, text, text, text, text, text, text, text
) from anon;

grant execute on function public.pay_recurring_expense(
  text, text, date, date, numeric, text, text, text, text, text, text, text, text, text, text
) to authenticated, service_role;

commit;
