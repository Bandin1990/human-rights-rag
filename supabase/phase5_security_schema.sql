-- Phase 5: Security, Row Level Security (RLS) & Audit Trails

create table if not exists case_management.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  complaint_id uuid not null references case_management.complaints(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null, -- e.g., 'STATUS_CHANGED', 'EVIDENCE_ADDED', 'AI_ANALYSIS_RUN'
  description text not null,
  previous_state jsonb,
  new_state jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Index for fast lookup by complaint
create index if not exists idx_audit_logs_complaint on case_management.audit_logs(complaint_id);

-------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-------------------------------------------------------------------------------

-- 1. Enable RLS on core tables
alter table case_management.complaints enable row level security;
alter table case_management.evidence_items enable row level security;

-- 2. Define policies for Complaints
-- Policy: System Admins can view/edit all cases
create policy "Admins have full access to complaints"
  on case_management.complaints
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from auth.users u 
      where u.id = auth.uid() 
      and (u.raw_user_meta_data->>'role') = 'system_admin'
    )
  );

-- Policy: Assigned Officers and Supervisors can view/edit their cases
create policy "Officers can access assigned complaints"
  on case_management.complaints
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from case_management.assignments a
      where a.complaint_id = case_management.complaints.id
      and a.officer_id = auth.uid()
      and a.active = true
    )
  );

-- Policy: Intake Officers can view/edit cases with status 'received' or 'screening'
create policy "Intake officers can access new complaints"
  on case_management.complaints
  as permissive
  for all
  to authenticated
  using (
    status in ('received', 'screening') 
    and exists (
      select 1 from auth.users u 
      where u.id = auth.uid() 
      and (u.raw_user_meta_data->>'role') = 'intake_officer'
    )
  );

-- 3. Define policies for Evidence Items
-- Policy: Inherit access from complaints table
create policy "Access evidence if access to complaint"
  on case_management.evidence_items
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from case_management.complaints c
      where c.id = case_management.evidence_items.complaint_id
      -- The complaint RLS policy will automatically filter this subquery
    )
  );
