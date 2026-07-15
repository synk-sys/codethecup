-- ============ TEAM-LEVEL SIGN-IN ============
-- Replaces per-member claiming with a single shared session per team.
alter table public.teams add column claimed_user_id uuid references auth.users(id) on delete set null;

create or replace function public.claim_team(_team_id uuid, _passcode text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _stored text;
begin
  select passcode into _stored from public.team_passcodes where team_id = _team_id;
  if _stored is null or _stored <> _passcode then
    raise exception 'Incorrect passcode';
  end if;

  update public.teams set claimed_user_id = auth.uid() where id = _team_id;
end;
$$;
grant execute on function public.claim_team(uuid, text) to authenticated;

-- get_user_team now resolves via the team's shared claimed session instead of
-- per-member linkage (team_members.user_id / email matching is no longer used).
create or replace function public.get_user_team(_user_id uuid, _event_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select t.id from public.teams t where t.event_id = _event_id and t.claimed_user_id = _user_id limit 1;
$$;
