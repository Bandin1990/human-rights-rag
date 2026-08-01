-- Phase 3: Evidence Management & Fact-Finding Schema Additions

create table if not exists case_management.evidence_files (
  id uuid primary key default extensions.gen_random_uuid(),
  evidence_item_id uuid not null references case_management.evidence_items(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  storage_path text not null,
  checksum text not null,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists case_management.evidence_insights (
  id uuid primary key default extensions.gen_random_uuid(),
  evidence_item_id uuid not null references case_management.evidence_items(id) on delete cascade,
  ai_run_id uuid, -- reference to ai_runs if tracking usage
  transcription_text text,
  ai_summary text,
  extracted_entities jsonb default '{}'::jsonb,
  relevance_to_allegations jsonb default '[]'::jsonb,
  confidence_score numeric(5, 4),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
