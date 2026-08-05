-- Semantic search for the NHRC case-note/research index (data/nhrc_index.json).
-- Separate table from public.document_sections on purpose: that one is
-- OpenAI-dimensioned (halfvec(1536), see schema.sql) for the unrelated
-- document-management feature; this dataset is embedded with Gemini
-- (text-embedding-004, 768 dims) via scripts/embed-nhrc-documents.mjs.
--
-- Apply this once via the Supabase SQL editor (no migration runner is set
-- up in this repo - schema.sql was applied the same way).

create extension if not exists vector with schema extensions;

create table if not exists public.nhrc_embeddings (
  document_id text primary key,
  embedding extensions.halfvec(768) not null,
  content_hash text not null, -- detects when a doc's embed-text changed and needs re-embedding
  created_at timestamptz not null default now()
);

create index if not exists nhrc_embeddings_hnsw_idx
  on public.nhrc_embeddings using hnsw (embedding extensions.halfvec_cosine_ops);

alter table public.nhrc_embeddings enable row level security;

-- Read-only for everyone - same public-read posture as the rest of the NHRC
-- dataset (data/nhrc_index.json etc. are already committed to the public repo).
create policy "Anyone can read nhrc embeddings"
  on public.nhrc_embeddings for select
  to anon, authenticated
  using (true);

-- Writes go through the service-role client only (scripts/embed-nhrc-documents.mjs),
-- which bypasses RLS - no insert/update policy needed for anon/authenticated.

create or replace function public.match_nhrc_documents(
  query_embedding extensions.halfvec(768),
  match_count integer default 10
)
returns table(document_id text, similarity double precision)
language sql stable
as $$
  select e.document_id, 1 - (e.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.nhrc_embeddings e
  order by e.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 100);
$$;

grant execute on function public.match_nhrc_documents(extensions.halfvec, integer) to anon, authenticated;
