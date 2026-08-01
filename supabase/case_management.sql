-- Private complaint, investigation, and report workspace.
-- Add `case_management` to the Supabase Data API exposed schemas before using
-- the authenticated web workspace. RLS remains the authorization boundary.

create schema if not exists case_management;
revoke all on schema case_management from public, anon;
grant usage on schema case_management to authenticated, service_role;

create table if not exists case_management.user_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in (
    'intake_officer','screening_officer','supervisor','case_officer',
    'report_screener','commissioner','committee_secretariat',
    'privacy_officer','auditor','system_admin',
    'group_head','bureau_director','executive'
  )),
  display_name text,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists case_management.complaints (
  id uuid primary key default extensions.gen_random_uuid(),
  reference_no text not null unique,
  title text not null,
  summary text not null,
  received_at timestamptz not null default now(),
  channel text not null check (channel in (
    'ยื่นต่อสำนักงาน','ยื่นต่อกรรมการ','ไปรษณีย์','ระบบอิเล็กทรอนิกส์',
    'วาจา','โทรศัพท์','หน่วยงานของรัฐส่งมา','คณะกรรมการหยิบยก'
  )),
  language text not null default 'th' check (language in ('th','en','th-en')),
  status text not null default 'received' check (status in (
    'received','completeness_check','awaiting_complainant','preliminary_fact_finding',
    'screening_summary','supervisor_review','committee_pending','accepted',
    'not_accepted','referred','other_mandate','notification_pending','closed',
    'planning','in_progress','report_drafting'
  )),
  priority text not null default 'normal' check (priority in ('normal','urgent','critical')),
  classification text not null default 'RESTRICTED' check (classification in ('RESTRICTED','HIGHLY_SENSITIVE')),
  vulnerable_group boolean not null default false,
  location text not null default '',
  desired_outcome text not null default '',
  rights_issues text[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists case_management.complaint_embeddings (
  id uuid primary key references case_management.complaints(id) on delete cascade,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists case_management.parties (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  party_role text not null check (party_role in ('complainant','affected_person','respondent','witness','representative','organization')),
  display_name text not null,
  organization_name text,
  protected_identity boolean not null default false,
  contact_hint text,
  created_at timestamptz not null default now()
);

create table if not exists case_management.allegations (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  description text not null,
  incident_at timestamptz,
  location text,
  created_at timestamptz not null default now()
);

create table if not exists case_management.assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null,
  assignment_role text not null check (assignment_role in ('intake_officer','screening_officer','case_officer','supervisor','commissioner')),
  assigned_at timestamptz not null default now(),
  active boolean not null default true
);

create table if not exists case_management.screening_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  facts_complete boolean not null default false,
  request_clear boolean not null default false,
  within_mandate boolean not null default false,
  sufficient_basis boolean not null default false,
  needs_more_facts boolean not null default false,
  officer_opinion text not null default '',
  legal_basis text not null default '',
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists case_management.deadlines (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  label text not null,
  trigger_event text not null,
  triggered_at timestamptz not null,
  due_at timestamptz not null,
  legal_basis text not null,
  status text not null default 'open' check (status in ('open','due_soon','overdue','completed')),
  owner_id uuid references auth.users(id) on delete restrict,
  owner_name text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (due_at >= triggered_at),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create table if not exists case_management.case_events (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  title text not null,
  description text not null,
  actor_id uuid references auth.users(id) on delete restrict,
  actor_name text not null,
  event_type text not null check (event_type in ('intake','screening','investigation','evidence','report','decision','ai')),
  created_at timestamptz not null default now()
);

create table if not exists case_management.evidence_items (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  evidence_code text not null,
  title text not null,
  evidence_type text not null check (evidence_type in ('document','statement','image','audio','video','digital')),
  source_name text not null,
  obtained_at timestamptz not null,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','disputed')),
  supports_allegations text[] not null default '{}',
  classification text not null default 'RESTRICTED' check (classification in ('RESTRICTED','HIGHLY_SENSITIVE')),
  storage_key text,
  checksum text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (complaint_id, evidence_code),
  check ((storage_key is null and checksum is null) or (storage_key is not null and checksum is not null))
);

create table if not exists case_management.reports (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null unique references case_management.complaints(id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft','supervisor_review','group_head_review','bureau_director_review',
    'executive_review','screening','committee_review','revision_requested',
    'approved','finalizing','final'
  )),
  current_version integer not null default 0 check (current_version >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists case_management.report_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid not null references case_management.reports(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  outcome text not null default 'pending' check (outcome in ('pending','violation','no_violation','terminated')),
  change_note text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  unique (report_id, version_no)
);

create table if not exists case_management.report_sections (
  id uuid primary key default extensions.gen_random_uuid(),
  report_version_id uuid not null references case_management.report_versions(id) on delete restrict,
  section_key text not null check (section_key in ('parties','complaint_summary','circumstances','legal_framework','analysis','measures')),
  section_order smallint not null check (section_order between 1 and 6),
  title text not null,
  requirement text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  unique (report_version_id, section_key),
  unique (report_version_id, section_order)
);

create table if not exists case_management.citations (
  id uuid primary key default extensions.gen_random_uuid(),
  report_section_id uuid not null references case_management.report_sections(id) on delete restrict,
  document_id text not null references public.documents(id) on delete restrict,
  document_section_id text not null references public.document_sections(id) on delete restrict,
  document_title text not null,
  page_number integer,
  anchor text,
  excerpt text not null,
  created_at timestamptz not null default now(),
  unique (report_section_id, document_section_id),
  check (page_number is null or page_number > 0)
);

create table if not exists case_management.ai_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  purpose text not null,
  input_hash text not null,
  model text not null,
  output_summary text not null default '',
  review_status text not null default 'generated' check (review_status in ('generated','reviewed','accepted','edited','rejected')),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((review_status = 'generated' and reviewed_at is null) or review_status <> 'generated')
);

create table if not exists case_management.audit_events (
  id bigint generated always as identity primary key,
  complaint_id uuid references case_management.complaints(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  event_data jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

-- Foreign-key and policy lookup indexes. PostgreSQL does not add these automatically.
create index if not exists case_user_roles_user_idx on case_management.user_roles(user_id, role);
create index if not exists complaints_status_received_idx on case_management.complaints(status, received_at desc);
create index if not exists complaints_priority_status_idx on case_management.complaints(priority, status) where status <> 'closed';
create index if not exists parties_complaint_idx on case_management.parties(complaint_id);
create index if not exists allegations_complaint_idx on case_management.allegations(complaint_id);
create index if not exists assignments_complaint_idx on case_management.assignments(complaint_id, active);
create index if not exists assignments_user_idx on case_management.assignments(user_id, active);
create unique index if not exists assignments_active_role_uidx on case_management.assignments(complaint_id, user_id, assignment_role) where active;
create index if not exists screening_complaint_created_idx on case_management.screening_reviews(complaint_id, created_at desc);
create index if not exists screening_reviewer_idx on case_management.screening_reviews(reviewed_by);
create index if not exists deadlines_complaint_due_idx on case_management.deadlines(complaint_id, due_at);
create index if not exists deadlines_owner_open_idx on case_management.deadlines(owner_id, due_at) where status in ('open','due_soon','overdue');
create index if not exists events_complaint_time_idx on case_management.case_events(complaint_id, occurred_at desc);
create index if not exists events_actor_idx on case_management.case_events(actor_id);
create index if not exists evidence_complaint_idx on case_management.evidence_items(complaint_id, obtained_at);
create index if not exists evidence_creator_idx on case_management.evidence_items(created_by);
create index if not exists reports_complaint_idx on case_management.reports(complaint_id);
create index if not exists reports_creator_idx on case_management.reports(created_by);
create index if not exists report_versions_report_idx on case_management.report_versions(report_id, version_no desc);
create index if not exists report_versions_creator_idx on case_management.report_versions(created_by);
create index if not exists report_sections_version_idx on case_management.report_sections(report_version_id, section_order);
create index if not exists citations_report_section_idx on case_management.citations(report_section_id);
create index if not exists citations_document_idx on case_management.citations(document_id, document_section_id);
create index if not exists ai_runs_complaint_time_idx on case_management.ai_runs(complaint_id, created_at desc);
create index if not exists ai_runs_requester_idx on case_management.ai_runs(requested_by);
create index if not exists ai_runs_reviewer_idx on case_management.ai_runs(reviewed_by);
create index if not exists audit_complaint_time_idx on case_management.audit_events(complaint_id, occurred_at desc);
create index if not exists audit_actor_time_idx on case_management.audit_events(actor_id, occurred_at desc);
create index if not exists audit_event_data_gin_idx on case_management.audit_events using gin(event_data);

-- Authorization helpers live outside public and always bind checks to auth.uid().
create or replace function case_management.has_case_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from case_management.user_roles r
    where r.user_id = (select auth.uid()) and r.role = any(required_roles)
  );
$$;

create or replace function case_management.can_access_complaint(target_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from case_management.assignments a
      where a.complaint_id = target_complaint_id
        and a.user_id = (select auth.uid())
        and a.active
    )
    or exists (
      select 1 from case_management.complaints c
      where c.id = target_complaint_id
        and c.created_by = (select auth.uid())
    )
    or exists (
      select 1 from case_management.user_roles r
      where r.user_id = (select auth.uid())
        and r.role in ('supervisor','report_screener','commissioner','committee_secretariat','privacy_officer','auditor')
    )
  );
$$;

create or replace function case_management.can_edit_complaint(target_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select case_management.can_access_complaint(target_complaint_id))
    and (select case_management.has_case_role(array['intake_officer','screening_officer','case_officer','supervisor']));
$$;

create or replace function case_management.can_edit_report(target_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select case_management.can_access_complaint(target_complaint_id))
    and (select case_management.has_case_role(array['case_officer','supervisor','report_screener']));
$$;

revoke all on function case_management.has_case_role(text[]) from public, anon;
revoke all on function case_management.can_access_complaint(uuid) from public, anon;
revoke all on function case_management.can_edit_complaint(uuid) from public, anon;
revoke all on function case_management.can_edit_report(uuid) from public, anon;
grant execute on function case_management.has_case_role(text[]) to authenticated, service_role;
grant execute on function case_management.can_access_complaint(uuid) to authenticated, service_role;
grant execute on function case_management.can_edit_complaint(uuid) to authenticated, service_role;
grant execute on function case_management.can_edit_report(uuid) to authenticated, service_role;

alter table case_management.user_roles enable row level security;
alter table case_management.complaints enable row level security;
alter table case_management.parties enable row level security;
alter table case_management.allegations enable row level security;
alter table case_management.assignments enable row level security;
alter table case_management.screening_reviews enable row level security;
alter table case_management.deadlines enable row level security;
alter table case_management.case_events enable row level security;
alter table case_management.evidence_items enable row level security;
alter table case_management.reports enable row level security;
alter table case_management.report_versions enable row level security;
alter table case_management.report_sections enable row level security;
alter table case_management.citations enable row level security;
alter table case_management.ai_runs enable row level security;
alter table case_management.audit_events enable row level security;

drop policy if exists "case roles read own role" on case_management.user_roles;
create policy "case roles read own role" on case_management.user_roles for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "case users read accessible complaints" on case_management.complaints;
create policy "case users read accessible complaints" on case_management.complaints for select to authenticated using ((select case_management.can_access_complaint(id)));
drop policy if exists "intake users create complaints" on case_management.complaints;
create policy "intake users create complaints" on case_management.complaints for insert to authenticated with check (
  created_by = (select auth.uid()) and (select case_management.has_case_role(array['intake_officer','screening_officer','supervisor']))
);
drop policy if exists "case users update accessible complaints" on case_management.complaints;
create policy "case users update accessible complaints" on case_management.complaints for update to authenticated using (
  (select case_management.can_edit_complaint(id))
) with check ((select case_management.can_edit_complaint(id)));

drop policy if exists "case users read parties" on case_management.parties;
create policy "case users read parties" on case_management.parties for select to authenticated using ((select case_management.can_access_complaint(complaint_id)));
drop policy if exists "case users create parties" on case_management.parties;
create policy "case users create parties" on case_management.parties for insert to authenticated with check ((select case_management.can_edit_complaint(complaint_id)));
drop policy if exists "case users update parties" on case_management.parties;
create policy "case users update parties" on case_management.parties for update to authenticated using ((select case_management.can_edit_complaint(complaint_id))) with check ((select case_management.can_edit_complaint(complaint_id)));

drop policy if exists "case users read allegations" on case_management.allegations;
create policy "case users read allegations" on case_management.allegations for select to authenticated using ((select case_management.can_access_complaint(complaint_id)));
drop policy if exists "case users create allegations" on case_management.allegations;
create policy "case users create allegations" on case_management.allegations for insert to authenticated with check ((select case_management.can_edit_complaint(complaint_id)));
drop policy if exists "case users update allegations" on case_management.allegations;
create policy "case users update allegations" on case_management.allegations for update to authenticated using ((select case_management.can_edit_complaint(complaint_id))) with check ((select case_management.can_edit_complaint(complaint_id)));

drop policy if exists "case users read assignments" on case_management.assignments;
create policy "case users read assignments" on case_management.assignments for select to authenticated using ((select case_management.can_access_complaint(complaint_id)) or user_id = (select auth.uid()));
drop policy if exists "authorized users create assignments" on case_management.assignments;
create policy "authorized users create assignments" on case_management.assignments for insert to authenticated with check (
  (user_id = (select auth.uid()) and (select case_management.has_case_role(array['intake_officer','screening_officer'])))
  or (select case_management.has_case_role(array['supervisor']))
);
drop policy if exists "supervisors update assignments" on case_management.assignments;
create policy "supervisors update assignments" on case_management.assignments for update to authenticated using ((select case_management.has_case_role(array['supervisor']))) with check ((select case_management.has_case_role(array['supervisor'])));

drop policy if exists "case users read screening" on case_management.screening_reviews;
create policy "case users read screening" on case_management.screening_reviews for select to authenticated using ((select case_management.can_access_complaint(complaint_id)));
drop policy if exists "screening users create reviews" on case_management.screening_reviews;
create policy "screening users create reviews" on case_management.screening_reviews for insert to authenticated with check (
  reviewed_by = (select auth.uid()) and (select case_management.can_edit_complaint(complaint_id))
);

drop policy if exists "case users read deadlines" on case_management.deadlines;
create policy "case users read deadlines" on case_management.deadlines for select to authenticated using ((select case_management.can_access_complaint(complaint_id)));
drop policy if exists "case users create deadlines" on case_management.deadlines;
create policy "case users create deadlines" on case_management.deadlines for insert to authenticated with check ((select case_management.can_edit_complaint(complaint_id)));
drop policy if exists "case users update deadlines" on case_management.deadlines;
create policy "case users update deadlines" on case_management.deadlines for update to authenticated using ((select case_management.can_edit_complaint(complaint_id))) with check ((select case_management.can_edit_complaint(complaint_id)));

drop policy if exists "case users read events" on case_management.case_events;
create policy "case users read events" on case_management.case_events for select to authenticated using ((select case_management.can_access_complaint(complaint_id)));
drop policy if exists "case users create events" on case_management.case_events;
create policy "case users create events" on case_management.case_events for insert to authenticated with check (
  actor_id = (select auth.uid()) and (select case_management.can_access_complaint(complaint_id))
);

drop policy if exists "case users read evidence" on case_management.evidence_items;
create policy "case users read evidence" on case_management.evidence_items for select to authenticated using ((select case_management.can_access_complaint(complaint_id)));
drop policy if exists "case officers create evidence" on case_management.evidence_items;
create policy "case officers create evidence" on case_management.evidence_items for insert to authenticated with check (
  created_by = (select auth.uid()) and (select case_management.can_edit_complaint(complaint_id))
);
drop policy if exists "case officers update evidence metadata" on case_management.evidence_items;
create policy "case officers update evidence metadata" on case_management.evidence_items for update to authenticated using ((select case_management.can_edit_complaint(complaint_id))) with check ((select case_management.can_edit_complaint(complaint_id)));

drop policy if exists "case users read reports" on case_management.reports;
create policy "case users read reports" on case_management.reports for select to authenticated using ((select case_management.can_access_complaint(complaint_id)));
drop policy if exists "report users create reports" on case_management.reports;
create policy "report users create reports" on case_management.reports for insert to authenticated with check (
  created_by = (select auth.uid()) and (select case_management.can_edit_report(complaint_id))
);
drop policy if exists "report users update reports" on case_management.reports;
create policy "report users update reports" on case_management.reports for update to authenticated using ((select case_management.can_edit_report(complaint_id))) with check ((select case_management.can_edit_report(complaint_id)));

drop policy if exists "case users read report versions" on case_management.report_versions;
create policy "case users read report versions" on case_management.report_versions for select to authenticated using (
  exists (select 1 from case_management.reports r where r.id = report_id and (select case_management.can_access_complaint(r.complaint_id)))
);
drop policy if exists "report users create versions" on case_management.report_versions;
create policy "report users create versions" on case_management.report_versions for insert to authenticated with check (
  created_by = (select auth.uid()) and exists (select 1 from case_management.reports r where r.id = report_id and (select case_management.can_edit_report(r.complaint_id)))
);

drop policy if exists "case users read report sections" on case_management.report_sections;
create policy "case users read report sections" on case_management.report_sections for select to authenticated using (
  exists (select 1 from case_management.report_versions v join case_management.reports r on r.id = v.report_id where v.id = report_version_id and (select case_management.can_access_complaint(r.complaint_id)))
);
drop policy if exists "report users create sections" on case_management.report_sections;
create policy "report users create sections" on case_management.report_sections for insert to authenticated with check (
  exists (select 1 from case_management.report_versions v join case_management.reports r on r.id = v.report_id where v.id = report_version_id and (select case_management.can_edit_report(r.complaint_id)))
);

drop policy if exists "case users read report citations" on case_management.citations;
create policy "case users read report citations" on case_management.citations for select to authenticated using (
  exists (select 1 from case_management.report_sections s join case_management.report_versions v on v.id = s.report_version_id join case_management.reports r on r.id = v.report_id where s.id = report_section_id and (select case_management.can_access_complaint(r.complaint_id)))
);
drop policy if exists "report users create citations" on case_management.citations;
create policy "report users create citations" on case_management.citations for insert to authenticated with check (
  exists (select 1 from case_management.report_sections s join case_management.report_versions v on v.id = s.report_version_id join case_management.reports r on r.id = v.report_id where s.id = report_section_id and (select case_management.can_edit_report(r.complaint_id)))
  and exists (select 1 from public.documents d where d.id = document_id and d.status = 'published' and d.access_scope = 'public')
);

drop policy if exists "case users read ai runs" on case_management.ai_runs;
create policy "case users read ai runs" on case_management.ai_runs for select to authenticated using ((select case_management.can_access_complaint(complaint_id)));
drop policy if exists "case users create ai runs" on case_management.ai_runs;
create policy "case users create ai runs" on case_management.ai_runs for insert to authenticated with check (
  requested_by = (select auth.uid()) and (select case_management.can_access_complaint(complaint_id))
);
drop policy if exists "case users review ai runs" on case_management.ai_runs;
create policy "case users review ai runs" on case_management.ai_runs for update to authenticated using (
  (select case_management.can_access_complaint(complaint_id))
) with check (
  (select case_management.can_access_complaint(complaint_id)) and reviewed_by = (select auth.uid())
);

drop policy if exists "audit roles read case audit" on case_management.audit_events;
create policy "audit roles read case audit" on case_management.audit_events for select to authenticated using (
  (select case_management.can_access_complaint(complaint_id))
  and (select case_management.has_case_role(array['auditor','supervisor','privacy_officer']))
);
drop policy if exists "case users append audit" on case_management.audit_events;
create policy "case users append audit" on case_management.audit_events for insert to authenticated with check (
  actor_id = (select auth.uid()) and (select case_management.can_access_complaint(complaint_id))
);

grant select on case_management.user_roles to authenticated;
grant select, insert, update on case_management.complaints, case_management.parties, case_management.allegations,
  case_management.assignments, case_management.screening_reviews, case_management.deadlines,
  case_management.case_events, case_management.evidence_items, case_management.reports,
  case_management.ai_runs to authenticated;
grant select, insert on case_management.report_versions, case_management.report_sections,
  case_management.citations, case_management.audit_events to authenticated;
grant all on all tables in schema case_management to service_role;
grant usage, select on all sequences in schema case_management to service_role;
grant usage, select on sequence case_management.audit_events_id_seq to authenticated;

-- Append-only audit events for status and report version changes. The trigger
-- records operational metadata, not full complaint text or party details.
create or replace function case_management.record_case_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  audit_entity_id text;
  audit_data jsonb;
begin
  if tg_table_name = 'complaints' then
    target_id := new.id;
    audit_entity_id := new.id::text;
    audit_data := jsonb_build_object(
      'old_status', case when tg_op = 'UPDATE' then old.status else null end,
      'new_status', new.status,
      'priority', new.priority,
      'classification', new.classification
    );
  elsif tg_table_name = 'reports' then
    target_id := new.complaint_id;
    audit_entity_id := new.id::text;
    audit_data := jsonb_build_object(
      'old_status', case when tg_op = 'UPDATE' then old.status else null end,
      'new_status', new.status,
      'old_version', case when tg_op = 'UPDATE' then old.current_version else null end,
      'new_version', new.current_version
    );
  else
    return new;
  end if;

  insert into case_management.audit_events(complaint_id, actor_id, action, entity_type, entity_id, event_data)
  values (target_id, (select auth.uid()), lower(tg_op), tg_table_name, audit_entity_id, audit_data);
  return new;
end;
$$;

revoke all on function case_management.record_case_audit() from public, anon, authenticated;
drop trigger if exists complaint_audit_trigger on case_management.complaints;
create trigger complaint_audit_trigger after insert or update on case_management.complaints
for each row execute function case_management.record_case_audit();
drop trigger if exists report_audit_trigger on case_management.reports;
create trigger report_audit_trigger after insert or update on case_management.reports
for each row execute function case_management.record_case_audit();

create or replace function case_management.block_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events are append-only';
end;
$$;

revoke all on function case_management.block_audit_mutation() from public, anon, authenticated;
drop trigger if exists audit_events_append_only on case_management.audit_events;
create trigger audit_events_append_only before update or delete on case_management.audit_events
for each row execute function case_management.block_audit_mutation();

-- Private evidence bucket. Object keys must start with `<complaint_uuid>/`.
insert into storage.buckets(id, name, public, file_size_limit)
values ('case-evidence', 'case-evidence', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "case users read assigned evidence objects" on storage.objects;
create policy "case users read assigned evidence objects" on storage.objects for select to authenticated using (
  bucket_id = 'case-evidence'
  and (select case_management.can_access_complaint((substring(name from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'))::uuid))
);
drop policy if exists "case users upload assigned evidence objects" on storage.objects;
create policy "case users upload assigned evidence objects" on storage.objects for insert to authenticated with check (
  bucket_id = 'case-evidence'
  and (select case_management.can_edit_complaint((substring(name from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'))::uuid))
);
drop policy if exists "case users replace assigned evidence objects" on storage.objects;
create policy "case users replace assigned evidence objects" on storage.objects for update to authenticated using (
  bucket_id = 'case-evidence'
  and (select case_management.can_edit_complaint((substring(name from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'))::uuid))
) with check (
  bucket_id = 'case-evidence'
  and (select case_management.can_edit_complaint((substring(name from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'))::uuid))
);

-- Atomic report save RPC
create or replace function case_management.save_report_version(
  p_complaint_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_intent text,
  p_outcome text,
  p_sections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report case_management.reports%rowtype;
  v_next_status text;
  v_version_no integer;
  v_version_id uuid;
  v_section_idx integer;
  v_section jsonb;
  v_section_id uuid;
  v_citation jsonb;
begin
  -- Check permission
  if not case_management.can_edit_report(p_complaint_id) then
    raise exception 'Permission denied';
  end if;

  v_next_status := case 
    when p_intent = 'submit_urgent' then 'committee_review'
    when p_intent = 'submit' then 'supervisor_review' 
    else 'draft' 
  end;
  
  select * into v_report from case_management.reports where complaint_id = p_complaint_id for update;
  if not found then
    insert into case_management.reports(complaint_id, status, current_version, created_by)
    values (p_complaint_id, 'draft', 0, p_actor_id)
    returning * into v_report;
  end if;

  v_version_no := coalesce(v_report.current_version, 0) + 1;

  insert into case_management.report_versions(report_id, version_no, outcome, created_by, created_by_name, change_note)
  values (v_report.id, v_version_no, p_outcome, p_actor_id, p_actor_name, case when p_intent = 'submit' then 'ส่งให้ผู้บังคับบัญชาตรวจ' when p_intent = 'submit_urgent' then 'ส่งเข้าคณะกรรมการ (เร่งด่วน)' else 'บันทึกร่าง' end)
  returning id into v_version_id;

  v_section_idx := 1;
  for v_section in select * from jsonb_array_elements(p_sections)
  loop
    insert into case_management.report_sections(report_version_id, section_key, section_order, title, requirement, content)
    values (v_version_id, v_section->>'key', v_section_idx, v_section->>'title', v_section->>'requirement', v_section->>'content')
    returning id into v_section_id;
    
    if v_section->'citations' is not null and jsonb_array_length(v_section->'citations') > 0 then
      for v_citation in select * from jsonb_array_elements(v_section->'citations')
      loop
        insert into case_management.citations(report_section_id, document_id, document_section_id, document_title, page_number, anchor, excerpt)
        values (
          v_section_id,
          v_citation->>'documentId',
          v_citation->>'sectionId',
          v_citation->>'title',
          (v_citation->>'page')::integer,
          v_citation->>'anchor',
          v_citation->>'excerpt'
        );
      end loop;
    end if;
    
    v_section_idx := v_section_idx + 1;
  end loop;

  update case_management.reports
  set current_version = v_version_no, status = v_next_status, updated_at = now()
  where id = v_report.id;

  return jsonb_build_object(
    'id', v_report.id,
    'version', v_version_no,
    'status', v_next_status
  );
end;
$$;

revoke all on function case_management.save_report_version(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function case_management.save_report_version(uuid, uuid, text, text, text, jsonb) to authenticated, service_role;

-- Semantic search for complaints
create or replace function case_management.match_complaints(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  similarity float
)
language sql stable
as $$
  select
    ce.id,
    1 - (ce.embedding <=> query_embedding) as similarity
  from case_management.complaint_embeddings ce
  where 1 - (ce.embedding <=> query_embedding) > match_threshold
  order by ce.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function case_management.match_complaints(vector, float, int) from public, anon, authenticated;
grant execute on function case_management.match_complaints(vector, float, int) to authenticated, service_role;
