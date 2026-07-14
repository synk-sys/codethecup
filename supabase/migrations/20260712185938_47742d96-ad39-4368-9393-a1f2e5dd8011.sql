
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'participant');
create type public.ballot_status as enum ('draft', 'submitted');
create type public.winner_reveal_style as enum ('kahoot', 'simple', 'list');
create type public.tie_break_rule as enum ('innovation', 'technical', 'usefulness', 'ballot_count', 'manual');
create type public.voting_power_mode as enum ('per_participant', 'per_team');

-- ============ UPDATED_AT TRIGGER FN ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles updatable by self" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles insertable by self" on public.profiles for insert to authenticated with check (auth.uid() = id);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "roles readable by self or admin" on public.user_roles for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "admin manages roles" on public.user_roles for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ EVENTS ============
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  event_date date,
  voting_start timestamptz,
  voting_end timestamptz,
  is_active boolean not null default true,
  results_published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events readable by authenticated" on public.events for select to authenticated using (true);
create policy "admin manages events" on public.events for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();

-- ============ EVENT SETTINGS ============
create table public.event_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  number_of_winners int not null default 2,
  allow_vote_edits boolean not null default true,
  live_rankings_visible boolean not null default false,
  min_votes_per_project int not null default 3,
  allow_same_challenge_voting boolean not null default true,
  block_self_voting boolean not null default true,
  voting_power_mode voting_power_mode not null default 'per_team',
  score_scale_min int not null default 1,
  score_scale_max int not null default 10,
  winner_reveal_style winner_reveal_style not null default 'kahoot',
  tie_break_order tie_break_rule[] not null default array['innovation','technical','usefulness','ballot_count','manual']::tie_break_rule[],
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.event_settings to authenticated;
grant all on public.event_settings to service_role;
alter table public.event_settings enable row level security;
create policy "settings readable by authenticated" on public.event_settings for select to authenticated using (true);
create policy "admin manages settings" on public.event_settings for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger event_settings_updated before update on public.event_settings for each row execute function public.set_updated_at();

-- ============ CHALLENGES ============
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  sponsor text,
  logo_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.challenges to authenticated;
grant all on public.challenges to service_role;
alter table public.challenges enable row level security;
create policy "challenges readable" on public.challenges for select to authenticated using (true);
create policy "admin manages challenges" on public.challenges for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger challenges_updated before update on public.challenges for each row execute function public.set_updated_at();

-- ============ CRITERIA ============
create table public.criteria (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  weight numeric(5,2) not null check (weight >= 0 and weight <= 100),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.criteria to authenticated;
grant all on public.criteria to service_role;
alter table public.criteria enable row level security;
create policy "criteria readable" on public.criteria for select to authenticated using (true);
create policy "admin manages criteria" on public.criteria for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger criteria_updated before update on public.criteria for each row execute function public.set_updated_at();

-- ============ TEAMS ============
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.teams to authenticated;
grant all on public.teams to service_role;
alter table public.teams enable row level security;
create policy "teams readable" on public.teams for select to authenticated using (true);
create policy "admin manages teams" on public.teams for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger teams_updated before update on public.teams for each row execute function public.set_updated_at();

-- ============ TEAM MEMBERS ============
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (team_id, email)
);
create index team_members_user_idx on public.team_members(user_id);
create index team_members_email_idx on public.team_members(lower(email));
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;
create policy "team members readable" on public.team_members for select to authenticated using (true);
create policy "admin manages team members" on public.team_members for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Helper: get current user's team for an event
create or replace function public.get_user_team(_user_id uuid, _event_id uuid)
returns uuid
language sql stable security definer set search_path = public, auth
as $$
  select tm.team_id
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  left join auth.users u on u.id = _user_id
  where t.event_id = _event_id
    and (tm.user_id = _user_id or lower(tm.email) = lower(u.email))
  limit 1;
$$;

-- Auto-link team_members.user_id when a user signs up
create or replace function public.link_team_member_on_signup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.team_members
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end;
$$;
create trigger on_auth_user_link_team after insert on auth.users for each row execute function public.link_team_member_on_signup();

-- ============ PROJECTS ============
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null unique references public.teams(id) on delete cascade,
  challenge_id uuid references public.challenges(id) on delete set null,
  title text not null,
  description text,
  demo_url text,
  github_url text,
  table_number text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "projects readable" on public.projects for select to authenticated using (true);
create policy "admin manages projects" on public.projects for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger projects_updated before update on public.projects for each row execute function public.set_updated_at();

-- ============ BALLOTS ============
create table public.ballots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  voter_team_id uuid references public.teams(id) on delete set null,
  status ballot_status not null default 'draft',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (voter_id, project_id)
);
create index ballots_project_idx on public.ballots(project_id);
create index ballots_voter_idx on public.ballots(voter_id);
grant select, insert, update, delete on public.ballots to authenticated;
grant all on public.ballots to service_role;
alter table public.ballots enable row level security;

-- Enforce no self-voting via trigger
create or replace function public.prevent_self_vote()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  proj_team uuid;
  voter_team uuid;
begin
  select team_id into proj_team from public.projects where id = new.project_id;
  select public.get_user_team(new.voter_id, new.event_id) into voter_team;
  if proj_team is not null and voter_team is not null and proj_team = voter_team then
    raise exception 'Participants cannot vote for their own team''s project';
  end if;
  new.voter_team_id := voter_team;
  return new;
end;
$$;
create trigger ballots_prevent_self before insert or update on public.ballots for each row execute function public.prevent_self_vote();
create trigger ballots_updated before update on public.ballots for each row execute function public.set_updated_at();

create policy "voter reads own ballots" on public.ballots for select to authenticated
using (voter_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "voter inserts own ballot" on public.ballots for insert to authenticated
with check (voter_id = auth.uid());
create policy "voter updates own ballot" on public.ballots for update to authenticated
using (voter_id = auth.uid()) with check (voter_id = auth.uid());
create policy "voter deletes own draft ballot" on public.ballots for delete to authenticated
using (voter_id = auth.uid() and status = 'draft');
create policy "admin reads all ballots" on public.ballots for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- ============ BALLOT SCORES ============
create table public.ballot_scores (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.ballots(id) on delete cascade,
  criterion_id uuid not null references public.criteria(id) on delete cascade,
  score numeric(5,2) not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ballot_id, criterion_id)
);
create index ballot_scores_ballot_idx on public.ballot_scores(ballot_id);
grant select, insert, update, delete on public.ballot_scores to authenticated;
grant all on public.ballot_scores to service_role;
alter table public.ballot_scores enable row level security;
create policy "scores readable by ballot owner or admin" on public.ballot_scores for select to authenticated
using (exists (select 1 from public.ballots b where b.id = ballot_id and (b.voter_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
create policy "scores writable by ballot owner" on public.ballot_scores for all to authenticated
using (exists (select 1 from public.ballots b where b.id = ballot_id and b.voter_id = auth.uid()))
with check (exists (select 1 from public.ballots b where b.id = ballot_id and b.voter_id = auth.uid()));
create trigger ballot_scores_updated before update on public.ballot_scores for each row execute function public.set_updated_at();

-- ============ SEED DEFAULT EVENT + CRITERIA ============
do $$
declare
  new_event_id uuid;
begin
  insert into public.events (name, description, event_date, is_active)
  values ('Code the Cup', 'Peer-judged hackathon', current_date, true)
  returning id into new_event_id;

  insert into public.event_settings (event_id) values (new_event_id);

  insert into public.criteria (event_id, name, description, weight, sort_order) values
  (new_event_id, 'Innovation & Creativity', 'How unique, novel, and creative is the solution? Does it address a problem in a new way or tackle an underserved challenge?', 30, 1),
  (new_event_id, 'Technical Execution', 'How well-built is the prototype? Consider code quality, stability, complexity, functionality, and completeness.', 25, 2),
  (new_event_id, 'Google Tool Utilization', 'How effectively did the project integrate relevant Google tools, APIs, or platforms such as Firebase, Google Cloud, Gemini API, or Maps Platform?', 5, 3),
  (new_event_id, 'Presentation & Completeness', 'How clearly did the team explain the problem, solution, and value proposition? Is the submission complete?', 15, 4),
  (new_event_id, 'How Cool Is It?', 'How engaging, exciting, impressive, memorable, and visually appealing is the project?', 10, 5),
  (new_event_id, 'Usefulness', 'How practical and impactful is the project? Does it solve a real-world problem or provide meaningful value?', 15, 6);
end $$;
