-- Prevent the public profile statistics RPC from revealing counts for private profiles.
create or replace function public.get_public_profile_stats(target_user_id uuid)
returns table(watched_count bigint, anime_likes_count bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (
      select count(*)::bigint
      from public.user_anime ua
      where ua.user_id = target_user_id
        and ua.status = 'seen'
    ),
    (
      select count(*)::bigint
      from public.anime_likes al
      where al.user_id = target_user_id
    )
  where exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and (p.is_private = false or p.id = (select auth.uid()))
  );
$function$;

revoke all on function public.get_public_profile_stats(uuid) from public;
grant execute on function public.get_public_profile_stats(uuid) to anon, authenticated, service_role;
