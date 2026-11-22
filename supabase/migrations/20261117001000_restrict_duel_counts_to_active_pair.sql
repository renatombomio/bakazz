-- Restrict the public RPC to the only duel currently served by the API.
create or replace function public.duel_counts(
  p_week date,
  p_a integer,
  p_b integer
)
returns table (a bigint, b bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_week is distinct from date_trunc('week', now() at time zone 'Europe/Amsterdam')::date then
    raise exception 'STALE_DUEL_WEEK' using errcode = '22023';
  end if;

  if p_a is distinct from 20 or p_b is distinct from 269 then
    raise exception 'INVALID_DUEL_PAIR' using errcode = '22023';
  end if;

  return query
    select
      count(*) filter (where anime_id = p_a),
      count(*) filter (where anime_id = p_b)
    from public.duel_votes
    where week = p_week
      and anime_id in (p_a, p_b);
end;
$$;

revoke all on function public.duel_counts(date, integer, integer) from public, anon, authenticated;
grant execute on function public.duel_counts(date, integer, integer) to authenticated;
