-- Phase 2: AI Screening and Approval Workflow Schema Additions

create table if not exists case_management.ai_recommendations (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  ai_run_id uuid, -- reference to an ai_runs table if exists
  recommended_outcome text not null check (recommended_outcome in ('accept_for_investigation', 'protection', 'assistance', 'reject', 'refer')),
  alternative_outcomes text[] default '{}',
  rights_issues text[] default '{}',
  jurisdiction_analysis jsonb not null,
  similar_cases jsonb default '[]'::jsonb,
  legal_sources jsonb default '[]'::jsonb,
  confidence numeric(5, 4),
  requires_human_decision boolean default true,
  created_at timestamptz not null default now()
);

create table if not exists case_management.screening_assessments (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  ai_recommendation_id uuid references case_management.ai_recommendations(id),
  officer_id uuid not null references auth.users(id),
  accepted_outcome text not null,
  accepted_rights_issues text[] default '{}',
  edited_analysis text,
  officer_opinion text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted_for_review', 'approved_by_supervisor', 'approved_by_director', 'sent_back')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists case_management.committee_decisions (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete restrict,
  screening_assessment_id uuid references case_management.screening_assessments(id),
  meeting_date date not null,
  agenda_number text,
  resolution text not null check (resolution in ('accept', 'reject', 'refer', 'more_info')),
  resolution_details text,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists case_management.decision_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  committee_decision_id uuid not null references case_management.committee_decisions(id) on delete cascade,
  action_type text not null check (action_type in ('open_investigation', 'open_protection', 'open_assistance', 'notify_rejection', 'notify_referral')),
  action_status text not null default 'pending' check (action_status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);
