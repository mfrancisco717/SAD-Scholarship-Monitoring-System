-- Student Scholarship Monitoring System schema.
-- Run in Supabase SQL Editor in a new project.
-- After running, create a staff Auth user, then promote its profile using the SQL below.
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  student_id text unique,
  email text not null,
  role text not null default 'scholar' check (role in ('scholar','staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.scholarship_programs (
  program_id uuid primary key default gen_random_uuid(),
  program_name text not null unique check (program_name in ('Merit Scholar','Community Scholar')),
  max_gwa numeric(3,2) not null check (max_gwa between 1 and 5),
  min_units integer not null check (min_units >= 0),
  max_failed integer not null default 0 check (max_failed >= 0),
  max_incomplete integer not null default 0 check (max_incomplete >= 0),
  max_dropped integer not null check (max_dropped >= 0),
  deadline timestamptz not null
);

create table if not exists public.scholar_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.user_profiles(user_id) on delete cascade,
  program_id uuid not null references public.scholarship_programs(program_id),
  assigned_by uuid references public.user_profiles(user_id),
  assigned_at timestamptz not null default now()
);

create table if not exists public.semester_submissions (
  submission_id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.scholar_assignments(assignment_id) on delete cascade,
  academic_year text not null,
  semester text not null,
  gwa numeric(3,2) not null check (gwa between 1.00 and 5.00),
  enrolled_units integer not null check (enrolled_units >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  incomplete_count integer not null default 0 check (incomplete_count >= 0),
  dropped_count integer not null default 0 check (dropped_count >= 0),
  evidence_reference text not null check (length(trim(evidence_reference)) > 0),
  submitted_at timestamptz not null default now(),
  verification_status text not null default 'Pending verification'
    check (verification_status in ('Pending verification','Verified','Returned')),
  verification_reason text,
  compliance_result text check (compliance_result in ('Compliant','With Deficiency')),
  deficiency_reasons text,
  renewal_decision text check (renewal_decision in ('Approved','Held')),
  renewal_notes text,
  updated_at timestamptz not null default now(),
  unique (assignment_id, academic_year, semester)
);

create table if not exists public.evaluation_history (
  evaluation_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.semester_submissions(submission_id) on delete cascade,
  actor_id uuid not null references public.user_profiles(user_id),
  result text not null,
  reasons text,
  evaluated_at timestamptz not null default now()
);

create table if not exists public.decision_history (
  decision_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.semester_submissions(submission_id) on delete cascade,
  actor_id uuid not null references public.user_profiles(user_id),
  action_type text not null check (action_type in ('verification','renewal')),
  decision text not null,
  notes text,
  decided_at timestamptz not null default now()
);

-- Create profile on auth signup. User metadata cannot choose their role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_profiles(user_id, full_name, student_id, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    nullif(new.raw_user_meta_data->>'student_id',''),
    new.email,
    'scholar'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Role-check helper. It only reads the authenticated user's own profile.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.role = 'staff'
  );
$$;

alter table public.user_profiles enable row level security;
alter table public.scholarship_programs enable row level security;
alter table public.scholar_assignments enable row level security;
alter table public.semester_submissions enable row level security;
alter table public.evaluation_history enable row level security;
alter table public.decision_history enable row level security;

revoke all on public.user_profiles, public.scholarship_programs, public.scholar_assignments,
  public.semester_submissions, public.evaluation_history, public.decision_history from anon, authenticated;
grant select on public.user_profiles to authenticated;
grant update (full_name) on public.user_profiles to authenticated;
grant select on public.scholarship_programs to authenticated;
grant select, insert, update on public.scholar_assignments to authenticated;
grant select, insert, update on public.semester_submissions to authenticated;
grant select, insert on public.evaluation_history to authenticated;
grant select, insert on public.decision_history to authenticated;
grant execute on function public.is_staff() to authenticated;

create policy "Users read own profile or staff read all"
on public.user_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "Staff update profiles"
on public.user_profiles for update to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "Authenticated read policies"
on public.scholarship_programs for select to authenticated using (true);
create policy "Staff manage programs"
on public.scholarship_programs for all to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "Scholar reads own assignment or staff reads all"
on public.scholar_assignments for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "Staff assign scholars"
on public.scholar_assignments for insert to authenticated
with check ((select public.is_staff()));
create policy "Staff update assignments"
on public.scholar_assignments for update to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "Scholar reads own submissions or staff reads all"
on public.semester_submissions for select to authenticated
using (
  exists(select 1 from public.scholar_assignments a
         where a.assignment_id = semester_submissions.assignment_id
         and a.user_id = (select auth.uid()))
  or (select public.is_staff())
);
create policy "Scholar creates own pending submission"
on public.semester_submissions for insert to authenticated
with check (
  verification_status = 'Pending verification'
  and compliance_result is null and renewal_decision is null
  and exists(select 1 from public.scholar_assignments a
             where a.assignment_id = semester_submissions.assignment_id
             and a.user_id = (select auth.uid()))
);
-- Do not grant direct UPDATE to scholars for status/decision fields.
create policy "Staff update submissions"
on public.semester_submissions for update to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "Users read related evaluation history"
on public.evaluation_history for select to authenticated
using ((select public.is_staff()) or exists(
  select 1 from public.semester_submissions s
  join public.scholar_assignments a on a.assignment_id=s.assignment_id
  where s.submission_id=evaluation_history.submission_id and a.user_id=(select auth.uid())
));
create policy "Staff add evaluation history"
on public.evaluation_history for insert to authenticated
with check ((select public.is_staff()) and actor_id=(select auth.uid()));

create policy "Users read related decision history"
on public.decision_history for select to authenticated
using ((select public.is_staff()) or exists(
  select 1 from public.semester_submissions s
  join public.scholar_assignments a on a.assignment_id=s.assignment_id
  where s.submission_id=decision_history.submission_id and a.user_id=(select auth.uid())
));
create policy "Staff add decision history"
on public.decision_history for insert to authenticated
with check ((select public.is_staff()) and actor_id=(select auth.uid()));

-- Staff-only verification RPC. The browser cannot mark itself as staff.
create or replace function public.verify_submission(p_submission_id uuid, p_verified boolean, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_status text;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  v_status := case when p_verified then 'Verified' else 'Returned' end;
  update public.semester_submissions
  set verification_status=v_status, verification_reason=nullif(trim(p_reason),''),
      compliance_result=null, deficiency_reasons=null, renewal_decision=null,
      renewal_notes=null, updated_at=now()
  where submission_id=p_submission_id;
  if not found then raise exception 'Submission not found'; end if;
  insert into public.decision_history(submission_id,actor_id,action_type,decision,notes)
  values(p_submission_id,auth.uid(),'verification',v_status,p_reason);
end;
$$;

create or replace function public.evaluate_compliance(p_submission_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  s public.semester_submissions%rowtype;
  a public.scholar_assignments%rowtype;
  p public.scholarship_programs%rowtype;
  v_reasons text[] := array[]::text[];
  v_result text;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  select * into s from public.semester_submissions where submission_id=p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if s.verification_status <> 'Verified' then raise exception 'Evidence must be verified before evaluation'; end if;
  select * into a from public.scholar_assignments where assignment_id=s.assignment_id;
  select * into p from public.scholarship_programs where program_id=a.program_id;

  if s.gwa > p.max_gwa then v_reasons := array_append(v_reasons, 'GWA exceeds program limit'); end if;
  if s.enrolled_units < p.min_units then v_reasons := array_append(v_reasons, 'Insufficient enrolled units'); end if;
  if s.failed_count > p.max_failed then v_reasons := array_append(v_reasons, 'Failed subject count exceeds limit'); end if;
  if s.incomplete_count > p.max_incomplete then v_reasons := array_append(v_reasons, 'Incomplete grade count exceeds limit'); end if;
  if s.dropped_count > p.max_dropped then v_reasons := array_append(v_reasons, 'Dropped subject count exceeds limit'); end if;
  if s.submitted_at > p.deadline then v_reasons := array_append(v_reasons, 'Submission was late'); end if;

  v_result := case when cardinality(v_reasons)=0 then 'Compliant' else 'With Deficiency' end;
  update public.semester_submissions
  set compliance_result=v_result,
      deficiency_reasons=case when cardinality(v_reasons)=0 then null else array_to_string(v_reasons,'; ') end,
      renewal_decision=null, renewal_notes=null, updated_at=now()
  where submission_id=p_submission_id;
  insert into public.evaluation_history(submission_id,actor_id,result,reasons)
  values(p_submission_id,auth.uid(),v_result,array_to_string(v_reasons,'; '));
end;
$$;

create or replace function public.record_renewal_decision(p_submission_id uuid, p_decision text, p_notes text)
returns void language plpgsql security definer set search_path = ''
as $$
declare s public.semester_submissions%rowtype;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if p_decision not in ('Approved','Held') then raise exception 'Decision must be Approved or Held'; end if;
  select * into s from public.semester_submissions where submission_id=p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if s.verification_status <> 'Verified' or s.compliance_result is null then
    raise exception 'Verify and evaluate the submission before recording renewal';
  end if;
  if p_decision='Approved' and s.compliance_result <> 'Compliant' then
    raise exception 'Only a Compliant submission may be approved';
  end if;
  update public.semester_submissions
  set renewal_decision=p_decision, renewal_notes=nullif(trim(p_notes),''), updated_at=now()
  where submission_id=p_submission_id;
  insert into public.decision_history(submission_id,actor_id,action_type,decision,notes)
  values(p_submission_id,auth.uid(),'renewal',p_decision,p_notes);
end;
$$;

revoke all on function public.verify_submission(uuid,boolean,text) from public, anon;
revoke all on function public.evaluate_compliance(uuid) from public, anon;
revoke all on function public.record_renewal_decision(uuid,text,text) from public, anon;
grant execute on function public.verify_submission(uuid,boolean,text) to authenticated;
grant execute on function public.evaluate_compliance(uuid) to authenticated;
grant execute on function public.record_renewal_decision(uuid,text,text) to authenticated;

-- Seed the two fictional exam policies. Deadline is stored with Manila's UTC+8 offset.
insert into public.scholarship_programs(program_name,max_gwa,min_units,max_failed,max_incomplete,max_dropped,deadline)
values
('Merit Scholar',1.75,18,0,0,0,'2026-10-30 17:00:00+08'),
('Community Scholar',2.25,15,0,0,1,'2026-10-30 17:00:00+08')
on conflict (program_name) do update set
max_gwa=excluded.max_gwa,min_units=excluded.min_units,max_failed=excluded.max_failed,
max_incomplete=excluded.max_incomplete,max_dropped=excluded.max_dropped,deadline=excluded.deadline;

-- After creating a staff account via Authentication -> Users and signing it up once,
-- run this with that user's UUID to promote the profile. Never promote an untrusted account.
-- update public.user_profiles set role='staff' where user_id='PASTE-STAFF-UUID-HERE';
