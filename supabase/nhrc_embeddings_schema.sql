-- Semantic search for the NHRC case-note/research index (data/nhrc_index.json).
-- Separate table from public.document_sections on purpose: that one is
-- OpenAI-dimensioned (halfvec(1536), see schema.sql) for the unrelated
-- document-management feature; this dataset is embedded with Gemini
-- (gemini-embedding-001, 768 dims) via scripts/embed-nhrc-documents.mjs.
--
-- Apply this via the Supabase SQL editor - safe to re-run any time (every
-- statement is idempotent), including against a database that already has
-- the pre-chunking version of this table from before.

create extension if not exists vector with schema extensions;

-- One row per CHUNK, not per document. Long documents (treaty text, annual
-- situation reports, General Comments with the full text pasted in) get
-- split into several ~3000-char pieces by embed-nhrc-documents.mjs so no
-- document has a hard length ceiling on what search can actually reach -
-- see buildChunks() there for how documents are split, and route.ts's use
-- of match_nhrc_documents' chunk_text for how a matched chunk (not just the
-- top of the file) becomes the excerpt an answer is grounded on.
--
-- Short documents (still the majority of the corpus) end up as exactly one
-- chunk (chunk_index = 0) - behaviour for those is unchanged from before.
create table if not exists public.nhrc_embeddings (
  document_id text not null,
  chunk_index integer not null default 0,
  chunk_text text not null default '',
  embedding extensions.halfvec(768) not null,
  content_hash text not null, -- hash of the *whole document's* embed-text (same value on every chunk row) - detects when a doc changed and needs re-chunking + re-embedding
  created_at timestamptz not null default now(),
  primary key (document_id, chunk_index)
);

-- Migrating an existing (pre-chunking) table: these are no-ops on a fresh
-- create, but bring an already-deployed table up to date in place.
alter table public.nhrc_embeddings add column if not exists chunk_index integer not null default 0;
alter table public.nhrc_embeddings add column if not exists chunk_text text not null default '';
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.nhrc_embeddings'::regclass
      and contype = 'p'
      and conkey = (select array_agg(attnum) from pg_attribute
                    where attrelid = 'public.nhrc_embeddings'::regclass and attname = 'document_id')
  ) then
    alter table public.nhrc_embeddings drop constraint nhrc_embeddings_pkey;
    alter table public.nhrc_embeddings add primary key (document_id, chunk_index);
  end if;
end $$;

create index if not exists nhrc_embeddings_hnsw_idx
  on public.nhrc_embeddings using hnsw (embedding extensions.halfvec_cosine_ops);

alter table public.nhrc_embeddings enable row level security;

-- Read-only for everyone - same public-read posture as the rest of the NHRC
-- dataset (data/nhrc_index.json etc. are already committed to the public repo).
drop policy if exists "Anyone can read nhrc embeddings" on public.nhrc_embeddings;
create policy "Anyone can read nhrc embeddings"
  on public.nhrc_embeddings for select
  to anon, authenticated
  using (true);

-- Writes go through the service-role client only (scripts/embed-nhrc-documents.mjs),
-- which bypasses RLS - no insert/update policy needed for anon/authenticated.

-- Two-stage match: (1) pull the nearest chunks overall using the HNSW index
-- (cheap even as the corpus grows into thousands of chunks), then (2) keep
-- only the single best-matching chunk per document. A document with its
-- full text spread across hundreds of chunks still surfaces as one ranked
-- result - via whichever chunk actually answers the question - instead of
-- diluting/duplicating results with every chunk of the same long document.
-- The old version returned a different set of columns (no chunk_text/
-- chunk_index) - Postgres won't let create-or-replace change a function's
-- return shape, so the old one has to be dropped first. Harmless no-op if
-- it's already been dropped/replaced by a previous run of this file.
drop function if exists public.match_nhrc_documents(extensions.halfvec, integer);

create function public.match_nhrc_documents(
  query_embedding extensions.halfvec(768),
  match_count integer default 10
)
returns table(document_id text, similarity double precision, chunk_text text, chunk_index integer)
language sql stable
as $$
  with candidates as (
    select
      e.document_id,
      e.chunk_index,
      e.chunk_text,
      1 - (e.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.nhrc_embeddings e
    order by e.embedding operator(extensions.<=>) query_embedding
    limit least(greatest(match_count, 1), 100) * 20
  ),
  best_per_doc as (
    select distinct on (document_id) document_id, chunk_index, chunk_text, similarity
    from candidates
    order by document_id, similarity desc
  )
  select document_id, similarity, chunk_text, chunk_index
  from best_per_doc
  order by similarity desc
  limit least(greatest(match_count, 1), 100);
$$;

grant execute on function public.match_nhrc_documents(extensions.halfvec, integer) to anon, authenticated;
