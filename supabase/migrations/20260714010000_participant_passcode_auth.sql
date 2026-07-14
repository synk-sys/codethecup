-- ============ TEAM PASSCODES ============
create table public.team_passcodes (
  team_id uuid primary key references public.teams(id) on delete cascade,
  passcode text not null,
  updated_at timestamptz not null default now()
);
alter table public.team_passcodes enable row level security;
grant select, insert, update, delete on public.team_passcodes to authenticated;
grant all on public.team_passcodes to service_role;
create policy "admin manages passcodes" on public.team_passcodes for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ CLAIM TEAM MEMBER (passcode-gated) ============
create or replace function public.claim_team_member(_team_member_id uuid, _passcode text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _team_id uuid;
  _stored text;
begin
  select team_id into _team_id from public.team_members where id = _team_member_id;
  if _team_id is null then
    raise exception 'Name not found';
  end if;

  select passcode into _stored from public.team_passcodes where team_id = _team_id;
  if _stored is null or _stored <> _passcode then
    raise exception 'Incorrect passcode';
  end if;

  update public.team_members
    set user_id = auth.uid()
    where id = _team_member_id and (user_id is null or user_id = auth.uid());
  if not found then
    raise exception 'This name has already been claimed';
  end if;
end;
$$;
grant execute on function public.claim_team_member(uuid, text) to authenticated;

-- ============ RELAX TEAM_MEMBERS FOR NAME-BASED ENTRY ============
alter table public.team_members alter column email drop not null;
create unique index team_members_team_name_idx on public.team_members (team_id, lower(name)) where name is not null;

-- ============ FIX HANDLE_NEW_USER FOR ANONYMOUS SIGN-IN ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
