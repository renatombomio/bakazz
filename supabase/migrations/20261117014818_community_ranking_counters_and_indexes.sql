-- Bounded community rankings backed by transactional counters.
create table if not exists public.anime_like_totals (
  anime_id integer primary key check (anime_id > 0),
  like_count bigint not null default 0 check (like_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.anime_like_totals enable row level security;
create policy "Anime like totals are publicly readable" on public.anime_like_totals
  for select to anon, authenticated using (true);
grant select on public.anime_like_totals to anon, authenticated;

create table if not exists public.community_debate_like_totals (
  debate_id uuid primary key references public.community_debates(id) on delete cascade,
  like_count bigint not null default 0 check (like_count >= 0),
  last_liked_at timestamptz not null default now()
);
alter table public.community_debate_like_totals enable row level security;
create policy "Debate like totals are publicly readable" on public.community_debate_like_totals
  for select to anon, authenticated using (true);
grant select on public.community_debate_like_totals to anon, authenticated;

insert into public.anime_like_totals (anime_id,like_count,updated_at)
select anime_id,count(*)::bigint,coalesce(max(created_at),now()) from public.anime_likes group by anime_id
on conflict (anime_id) do update set like_count=excluded.like_count,updated_at=excluded.updated_at;
insert into public.community_debate_like_totals (debate_id,like_count,last_liked_at)
select debate_id,count(*)::bigint,coalesce(max(created_at),now()) from public.community_debate_likes group by debate_id
on conflict (debate_id) do update set like_count=excluded.like_count,last_liked_at=excluded.last_liked_at;

create index if not exists anime_like_totals_rank_idx on public.anime_like_totals (like_count desc,updated_at desc);
create index if not exists community_debate_like_totals_rank_idx on public.community_debate_like_totals (like_count desc,last_liked_at desc);
create index if not exists character_like_totals_rank_idx on public.character_like_totals (like_count desc,updated_at desc);
create index if not exists community_debate_comments_visible_recent_idx on public.community_debate_comments (debate_id,created_at desc) where status='visible';
create index if not exists anime_comments_recent_idx on public.anime_comments (created_at desc);
create index if not exists profiles_public_recent_idx on public.profiles (created_at desc) where is_private=false and aka is not null;

create or replace function public.sync_anime_like_totals() returns trigger
language plpgsql security definer set search_path=''
as $function$
begin
 if tg_op='INSERT' then
  insert into public.anime_like_totals(anime_id,like_count,updated_at) values(new.anime_id,1,new.created_at)
  on conflict(anime_id) do update set like_count=public.anime_like_totals.like_count+1,updated_at=greatest(public.anime_like_totals.updated_at,excluded.updated_at);
  return new;
 elsif tg_op='DELETE' then
  update public.anime_like_totals set like_count=greatest(0,like_count-1),updated_at=now() where anime_id=old.anime_id;
  delete from public.anime_like_totals where anime_id=old.anime_id and like_count=0;
  return old;
 end if;
 return null;
end;
$function$;
revoke all on function public.sync_anime_like_totals() from public,anon,authenticated;
drop trigger if exists anime_likes_sync_totals on public.anime_likes;
create trigger anime_likes_sync_totals after insert or delete on public.anime_likes for each row execute function public.sync_anime_like_totals();

create or replace function public.sync_community_debate_like_totals() returns trigger
language plpgsql security definer set search_path=''
as $function$
begin
 if tg_op='INSERT' then
  insert into public.community_debate_like_totals(debate_id,like_count,last_liked_at) values(new.debate_id,1,new.created_at)
  on conflict(debate_id) do update set like_count=public.community_debate_like_totals.like_count+1,last_liked_at=greatest(public.community_debate_like_totals.last_liked_at,excluded.last_liked_at);
  return new;
 elsif tg_op='DELETE' then
  update public.community_debate_like_totals set like_count=greatest(0,like_count-1),
   last_liked_at=coalesce((select max(l.created_at) from public.community_debate_likes l where l.debate_id=old.debate_id),now())
   where debate_id=old.debate_id;
  delete from public.community_debate_like_totals where debate_id=old.debate_id and like_count=0;
  return old;
 end if;
 return null;
end;
$function$;
revoke all on function public.sync_community_debate_like_totals() from public,anon,authenticated;
drop trigger if exists community_debate_likes_sync_totals on public.community_debate_likes;
create trigger community_debate_likes_sync_totals after insert or delete on public.community_debate_likes for each row execute function public.sync_community_debate_like_totals();
