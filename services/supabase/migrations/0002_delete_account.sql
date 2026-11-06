-- PlotFramer — let a signed-in user delete their own account and all of its data (launch requirement: GDPR-style
-- "right to erasure"). Run in the Supabase SQL editor after 0001_init.sql.
-- Everything the user owns (projects -> shares, subscriptions, unlocks) is removed by the ON DELETE CASCADE foreign
-- keys defined in 0001. STATUS: not yet executed against a live project.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
