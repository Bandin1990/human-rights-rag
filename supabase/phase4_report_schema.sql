-- Phase 4: AI Report Studio & Follow-up Schema Additions

create table if not exists case_management.follow_up_tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  committee_decision_id uuid references case_management.committee_decisions(id) on delete restrict,
  agency_name text not null,
  assigned_action text not null,
  deadline_date date not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'overdue', 'escalated')),
  response_summary text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists case_management.report_ai_drafts (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  section_type text not null, -- e.g., 'background', 'facts', 'legal_analysis', 'conclusion'
  draft_content text not null,
  used_context jsonb not null, -- The evidence/facts passed to the AI to generate this
  status text not null default 'draft' check (status in ('draft', 'accepted', 'rejected')),
  generated_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
