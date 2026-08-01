-- Phase 1: Omnichannel Intake and AI Extraction Schema Additions

create table if not exists case_management.intake_channels (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  channel_type text not null check (channel_type in ('email', 'api', 'manual', 'webhook')),
  config jsonb default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists case_management.intake_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  channel_id uuid not null references case_management.intake_channels(id) on delete restrict,
  external_reference text, -- For idempotency (e.g. email message ID)
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  unique(channel_id, external_reference)
);

create table if not exists case_management.ingestion_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  source_type text not null check (source_type in ('message', 'file')),
  source_id uuid not null, -- references either intake_messages.id or source_files.id
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  progress smallint default 0,
  error_summary text,
  retry_count smallint default 0,
  created_by uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists case_management.source_files (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid references case_management.complaints(id) on delete cascade,
  intake_message_id uuid references case_management.intake_messages(id) on delete set null,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  storage_path text not null,
  checksum text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists case_management.transcripts (
  id uuid primary key default extensions.gen_random_uuid(),
  source_file_id uuid not null references case_management.source_files(id) on delete cascade,
  content text not null,
  page_number integer,
  timecode text,
  created_at timestamptz not null default now()
);

create table if not exists case_management.extracted_fields (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  source_id uuid, -- could reference a transcript or source_file
  ai_run_id uuid, -- reference to ai_runs table (to be created later or null for now)
  field_key text not null,
  field_value jsonb not null,
  confidence_score numeric(5, 4),
  source_excerpt text,
  status text not null default 'pending_review' check (status in ('pending_review', 'accepted', 'edited', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists case_management.field_provenance (
  id uuid primary key default extensions.gen_random_uuid(),
  extracted_field_id uuid not null references case_management.extracted_fields(id) on delete cascade,
  previous_value jsonb,
  new_value jsonb not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);
