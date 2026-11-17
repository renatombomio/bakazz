-- Proposed only. Apply to Development after explicit approval; never apply to Production from this file.
alter table public.profiles
  add column if not exists instagram text
    check (instagram is null or instagram ~ '^[a-z0-9._]{1,30}$'),
  add column if not exists tiktok text
    check (tiktok is null or tiktok ~ '^[a-z0-9._]{2,24}$'),
  add column if not exists banner_y smallint not null default 50
    check (banner_y between 0 and 100);
