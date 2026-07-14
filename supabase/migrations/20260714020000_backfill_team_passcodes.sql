insert into public.team_passcodes (team_id, passcode)
select t.id, upper(substr(md5(random()::text || t.id::text), 1, 6))
from public.teams t
where not exists (select 1 from public.team_passcodes p where p.team_id = t.id);
