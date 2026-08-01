-- Phase 1 Blueprint: Omnichannel Intake & AI Extraction Schema
-- Adds the missing tables requested in the blueprint.

create schema if not exists case_management;

-- 1. Intake Channels
create table if not exists case_management.intake_channels (
  id uuid primary key default extensions.gen_random_uuid(),
  channel_code text not null unique,
  name text not null,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Intake Messages (Raw Payload from any channel)
create table if not exists case_management.intake_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  channel_id uuid not null references case_management.intake_channels(id) on delete restrict,
  external_id text, -- for idempotency
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'duplicate')),
  complaint_id uuid references case_management.complaints(id) on delete set null,
  received_at timestamptz not null default now(),
  unique(channel_id, external_id)
);

-- 3. Source Files (Original files immutable)
create table if not exists case_management.source_files (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  intake_message_id uuid references case_management.intake_messages(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  checksum text not null,
  uploaded_by uuid references auth.users(id) on delete restrict,
  uploaded_at timestamptz not null default now()
);

-- 4. Ingestion Jobs
create table if not exists case_management.ingestion_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  source_file_id uuid not null references case_management.source_files(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. Transcripts (OCR / STT results)
create table if not exists case_management.transcripts (
  id uuid primary key default extensions.gen_random_uuid(),
  source_file_id uuid not null references case_management.source_files(id) on delete cascade,
  page_number integer,
  timecode_start numeric,
  timecode_end numeric,
  content text not null,
  created_at timestamptz not null default now()
);

-- 6. AI Runs (Record of an AI process execution)
create table if not exists case_management.ai_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid references case_management.complaints(id) on delete cascade,
  run_type text not null check (run_type in ('extraction', 'screening', 'report_draft')),
  model_version text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_by uuid references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 7. AI Inputs (Context provided to AI)
create table if not exists case_management.ai_inputs (
  id uuid primary key default extensions.gen_random_uuid(),
  ai_run_id uuid not null references case_management.ai_runs(id) on delete cascade,
  input_type text not null,
  input_reference text not null,
  created_at timestamptz not null default now()
);

-- 8. AI Outputs & Extracted Fields
create table if not exists case_management.extracted_fields (
  id uuid primary key default extensions.gen_random_uuid(),
  ai_run_id uuid not null references case_management.ai_runs(id) on delete cascade,
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  field_name text not null,
  extracted_value text,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  status text not null default 'generated' check (status in ('generated', 'reviewed', 'accepted', 'edited', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  final_value text,
  created_at timestamptz not null default now()
);

-- 9. Field Provenance (Link field to transcript)
create table if not exists case_management.field_provenance (
  id uuid primary key default extensions.gen_random_uuid(),
  extracted_field_id uuid not null references case_management.extracted_fields(id) on delete cascade,
  transcript_id uuid not null references case_management.transcripts(id) on delete cascade,
  source_excerpt text not null,
  created_at timestamptz not null default now()
);
