-- Case Management System Schema

create schema if not exists case_management;

create table if not exists case_management.complaints (
  id uuid primary key default extensions.gen_random_uuid(),
  reference_no text not null unique,
  title text not null,
  summary text not null,
  received_at timestamptz not null default now(),
  channel text not null,
  language text not null default 'th',
  status text not null default 'completeness_check',
  priority text not null default 'normal',
  classification text not null default 'RESTRICTED',
  vulnerable_group boolean not null default false,
  location text not null,
  desired_outcome text not null,
  rights_issues text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists case_management.parties (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  party_role text not null check (party_role in ('complainant','respondent','witness')),
  display_name text not null,
  organization_name text,
  protected_identity boolean not null default false,
  contact_hint text
);

create table if not exists case_management.allegations (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  description text not null
);

create table if not exists case_management.assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  user_id uuid,
  display_name text not null,
  assignment_role text not null,
  active boolean not null default true
);

create table if not exists case_management.deadlines (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  label text not null,
  trigger_event text,
  triggered_at timestamptz,
  due_at timestamptz not null,
  legal_basis text,
  status text not null default 'open',
  owner_id uuid,
  owner_name text not null
);

create table if not exists case_management.case_events (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  title text not null,
  description text not null,
  actor_id uuid,
  actor_name text not null,
  event_type text not null default 'investigation'
);

create table if not exists case_management.evidence_items (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  evidence_code text not null,
  title text not null,
  evidence_type text not null default 'document',
  source_name text not null,
  obtained_at timestamptz not null default now(),
  verification_status text not null default 'pending',
  supports_allegations text[] not null default '{}',
  classification text not null default 'RESTRICTED'
);

create table if not exists case_management.screening_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  facts_complete boolean not null default false,
  request_clear boolean not null default false,
  within_mandate boolean not null default false,
  sufficient_basis boolean not null default false,
  needs_more_facts boolean not null default false,
  officer_opinion text,
  legal_basis text,
  created_at timestamptz not null default now()
);

create table if not exists case_management.reports (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  current_version integer not null default 0,
  status text not null default 'draft',
  updated_at timestamptz not null default now(),
  unique(complaint_id)
);

create table if not exists case_management.report_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid not null references case_management.reports(id) on delete cascade,
  version_no integer not null,
  outcome text not null default 'pending',
  created_at timestamptz not null default now(),
  created_by_name text not null,
  unique(report_id, version_no)
);

create table if not exists case_management.report_sections (
  id uuid primary key default extensions.gen_random_uuid(),
  report_version_id uuid not null references case_management.report_versions(id) on delete cascade,
  section_order integer not null,
  section_key text not null,
  title text not null,
  requirement text,
  content text not null default ''
);

create table if not exists case_management.citations (
  id uuid primary key default extensions.gen_random_uuid(),
  report_section_id uuid not null references case_management.report_sections(id) on delete cascade,
  document_id text not null,
  document_section_id text not null,
  document_title text not null,
  page_number integer,
  anchor text,
  excerpt text not null
);

create table if not exists case_management.ai_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  requested_by uuid,
  purpose text not null,
  input_hash text not null,
  model text not null,
  output_summary text not null,
  review_status text not null default 'generated',
  created_at timestamptz not null default now()
);

create table if not exists case_management.follow_ups (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  report_version_id uuid references case_management.report_versions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'partially_implemented', 'implemented', 'ignored')),
  notes text,
  deadline_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_name text
);

-- RLS setup
alter table case_management.complaints enable row level security;
alter table case_management.parties enable row level security;
alter table case_management.allegations enable row level security;
alter table case_management.assignments enable row level security;
alter table case_management.deadlines enable row level security;
alter table case_management.case_events enable row level security;
alter table case_management.evidence_items enable row level security;
alter table case_management.screening_reviews enable row level security;
alter table case_management.reports enable row level security;
alter table case_management.report_versions enable row level security;
alter table case_management.report_sections enable row level security;
alter table case_management.citations enable row level security;
alter table case_management.follow_ups enable row level security;

-- Open policies for demo/admin purposes, should be restricted based on roles in real usage
create policy "Allow all authenticated" on case_management.complaints for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.parties for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.allegations for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.assignments for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.deadlines for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.case_events for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.evidence_items for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.screening_reviews for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.reports for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.report_versions for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.report_sections for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.citations for all to authenticated using (true);
create policy "Allow all authenticated" on case_management.follow_ups for all to authenticated using (true);

-- Also need a save_report_version function for RPC since the API calls it
create or replace function case_management.save_report_version(
  p_complaint_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_intent text,
  p_outcome text,
  p_sections jsonb
) returns json language plpgsql as $$
declare
  v_report_id uuid;
  v_version_no int;
  v_status text;
  v_version_id uuid;
  v_section jsonb;
  v_section_id uuid;
  v_citation jsonb;
  i int := 0;
begin
  -- Get or create report
  select id, current_version into v_report_id, v_version_no from case_management.reports where complaint_id = p_complaint_id;
  
  if v_report_id is null then
    insert into case_management.reports (complaint_id, current_version, status, updated_at) 
    values (p_complaint_id, 1, 'draft', now()) returning id into v_report_id;
    v_version_no := 1;
  else
    v_version_no := v_version_no + 1;
  end if;

  v_status := case when p_intent = 'submit' then 'supervisor_review' else 'draft' end;

  update case_management.reports set current_version = v_version_no, status = v_status, updated_at = now() where id = v_report_id;

  -- Insert new version
  insert into case_management.report_versions (report_id, version_no, outcome, created_by_name)
  values (v_report_id, v_version_no, p_outcome, p_actor_name) returning id into v_version_id;

  -- Insert sections
  for v_section in select * from jsonb_array_elements(p_sections) loop
    insert into case_management.report_sections (report_version_id, section_order, section_key, title, requirement, content)
    values (v_version_id, i, v_section->>'key', v_section->>'title', v_section->>'requirement', v_section->>'content')
    returning id into v_section_id;

    -- Insert citations for this section
    for v_citation in select * from jsonb_array_elements(v_section->'citations') loop
      insert into case_management.citations (report_section_id, document_id, document_section_id, document_title, page_number, anchor, excerpt)
      values (v_section_id, v_citation->>'documentId', v_citation->>'sectionId', v_citation->>'title', (v_citation->>'page')::int, v_citation->>'anchor', v_citation->>'excerpt');
    end loop;
    i := i + 1;
  end loop;

  return json_build_object('id', v_report_id, 'version', v_version_no, 'status', v_status);
end;
$$;
