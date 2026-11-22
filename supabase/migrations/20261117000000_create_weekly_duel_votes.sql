-- Weekly Duel votes. Applied to the Renanime Development Supabase project.
create table public.duel_votes (
  week date not null check (week = date_trunc('week', week::timestamp)::date),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id integer not null check (anime_id > 0),
  created_at timestamptz not null default now(),
  constraint duel_votes_week_user_pk primary key (week, user_id)
);

create index duel_votes_week_anime_idx
  on public.duel_votes (week, anime_id);

alter table public.duel_votes enable row level security;

revoke all on table public.duel_votes from anon, authenticated;
grant select, insert on table public.duel_votes to authenticated;

create policy "Users can read their own weekly duel vote"
  on public.duel_votes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can cast their own weekly duel vote"
  on public.duel_votes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

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

  if p_a is null or p_b is null or p_a <= 0 or p_b <= 0 or p_a = p_b then
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
