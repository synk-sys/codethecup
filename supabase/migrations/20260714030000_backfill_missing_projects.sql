insert into public.projects (event_id, team_id, title)
select t.event_id, t.id, null
from public.teams t
where not exists (select 1 from public.projects p where p.team_id = t.id);
