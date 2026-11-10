-- دالة جلب قائمة اللوتات (للأدمن)
-- نفّذه مرة واحدة في Supabase → SQL Editor
create or replace function public.admin_list_lots()
returns table(lot text, brand text, total bigint)
language sql
security definer
set search_path = public
as $$
  select lot, min(brand) as brand, count(*)::bigint as total
  from qr_codes
  where lot is not null and lot <> ''
  group by lot
  order by lot;
$$;

grant execute on function public.admin_list_lots() to authenticated;
