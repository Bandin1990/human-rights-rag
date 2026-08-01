-- Bootstrap schema for the public Human Rights Knowledge System.
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.user_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null, -- references auth.users(id)
  role text not null check (role in ('importer','reviewer','publisher')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create table if not exists public.documents (
  id text primary key default extensions.gen_random_uuid()::text,
  title text not null, summary text, document_type text not null, document_number text,
  publication_year integer, buddhist_year integer, published_at text,
  source_organization text not null, source_system text not null, source_url text,
  authority_level text not null, language text not null default 'th' check (language in ('th','en','th-en')),
  rights_categories text[] not null default '{}', file_formats text[] not null default '{}',
  page_count integer check (page_count is null or page_count > 0),
  access_scope text not null default 'public' check (access_scope in ('public','internal','restricted')),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','processing','published','archived','failed')),
  featured boolean not null default false, checksum text, verified_at timestamptz,
  created_by uuid,
  reviewed_by uuid,
  published_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.document_files (
  id uuid primary key default extensions.gen_random_uuid(), document_id text not null references public.documents(id) on delete cascade,
  file_format text not null check (file_format in ('pdf','docx','doc','md','html')),
  storage_provider text not null default 'r2', storage_key text not null, source_url text,
  mime_type text not null, byte_size bigint check (byte_size is null or byte_size >= 0),
  checksum text not null, is_primary boolean not null default false, created_at timestamptz not null default now(),
  unique(storage_provider,storage_key)
);

create table if not exists public.document_sections (
  id text primary key default extensions.gen_random_uuid()::text, document_id text not null references public.documents(id) on delete cascade,
  section_index integer not null, page_number integer, anchor text, heading text not null default '', content text not null,
  language text not null default 'th', token_count integer, embedding extensions.halfvec(1536), metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), unique(document_id,section_index)
);

create index if not exists documents_public_filter_idx on public.documents(status,access_scope,buddhist_year,document_type,source_system);
create index if not exists documents_rights_categories_idx on public.documents using gin(rights_categories);
create index if not exists document_files_document_idx on public.document_files(document_id);
create index if not exists sections_document_idx on public.document_sections(document_id,section_index);
create index if not exists sections_content_fts_idx on public.document_sections using gin(to_tsvector('simple',content));
create index if not exists sections_embedding_hnsw_idx on public.document_sections using hnsw (embedding extensions.halfvec_cosine_ops);

alter table public.documents enable row level security;
alter table public.document_files enable row level security;
alter table public.document_sections enable row level security;

create policy "Users can read own role" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create policy "Public can read published documents" on public.documents for select to anon,authenticated using (access_scope='public' and status='published');
create policy "Authenticated can read any document" on public.documents for select to authenticated using (exists(select 1 from public.user_roles where user_id = auth.uid()));
create policy "Importers can insert documents" on public.documents for insert to authenticated with check (exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'importer'));
create policy "Importers can update own draft documents" on public.documents for update to authenticated using (exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'importer') and created_by = auth.uid() and status in ('draft', 'pending_review'));
create policy "Reviewers can update pending_review documents" on public.documents for update to authenticated using (exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'reviewer') and status = 'pending_review');
create policy "Publishers can update approved documents" on public.documents for update to authenticated using (exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'publisher') and status = 'approved');

create policy "Public can read files of published documents" on public.document_files for select to anon,authenticated using (exists(select 1 from public.documents d where d.id=document_id and d.access_scope='public' and d.status='published'));
create policy "Authenticated can read files of any document" on public.document_files for select to authenticated using (exists(select 1 from public.user_roles where user_id = auth.uid()));
create policy "Importers can insert document files" on public.document_files for insert to authenticated with check (exists(select 1 from public.documents d where d.id=document_id and d.created_by = auth.uid() and d.status = 'draft'));

create policy "Public can read sections of published documents" on public.document_sections for select to anon,authenticated using (exists(select 1 from public.documents d where d.id=document_id and d.access_scope='public' and d.status='published'));
create policy "Authenticated can read sections of any document" on public.document_sections for select to authenticated using (exists(select 1 from public.user_roles where user_id = auth.uid()));
create policy "Importers can insert sections" on public.document_sections for insert to authenticated with check (exists(select 1 from public.documents d where d.id=document_id and d.created_by = auth.uid() and d.status = 'draft'));

grant select on public.documents,public.document_files,public.document_sections,public.user_roles to anon,authenticated;
grant insert,update on public.documents,public.document_files,public.document_sections to authenticated;

create or replace function public.search_public_documents(
  search_query text default null, filter_year integer default null, filter_type text default null,
  filter_category text default null, filter_source text default null, filter_language text default null, result_limit integer default 50
) returns setof public.documents language sql stable security invoker set search_path='' as $$
 select d.* from public.documents d where d.access_scope='public' and d.status='published'
 and (filter_year is null or d.buddhist_year=filter_year) and (filter_type is null or d.document_type=filter_type)
 and (filter_category is null or filter_category=any(d.rights_categories)) and (filter_source is null or d.source_system=filter_source)
 and (filter_language is null or d.language=filter_language)
 and (search_query is null or btrim(search_query)='' or d.title ilike '%'||search_query||'%' or coalesce(d.summary,'') ilike '%'||search_query||'%'
      or extensions.word_similarity(search_query,d.title||' '||coalesce(d.summary,''))>0.25
      or coalesce(d.document_number,'') ilike '%'||search_query||'%'
      or exists(select 1 from public.document_sections s where s.document_id=d.id and to_tsvector('simple',s.content) @@ websearch_to_tsquery('simple',search_query)))
 order by d.featured desc,d.publication_year desc nulls last,d.title limit least(greatest(result_limit,1),100);
$$;
grant execute on function public.search_public_documents(text,integer,text,text,text,text,integer) to anon,authenticated;

create or replace function public.match_public_sections(
 query_embedding extensions.halfvec(1536), match_threshold double precision default 0.65,
 match_count integer default 20, filter_category text default null
) returns table(section_id text,document_id text,heading text,content text,page_number integer,anchor text,similarity double precision)
language sql stable security invoker set search_path='' as $$
 select s.id,s.document_id,s.heading,s.content,s.page_number,s.anchor,1-(s.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
 from public.document_sections s join public.documents d on d.id=s.document_id
 where d.access_scope='public' and d.status='published' and s.embedding is not null
 and (filter_category is null or filter_category=any(d.rights_categories)) and 1-(s.embedding OPERATOR(extensions.<=>) query_embedding)>=match_threshold
 order by s.embedding OPERATOR(extensions.<=>) query_embedding limit least(greatest(match_count,1),100);
$$;
grant execute on function public.match_public_sections(extensions.halfvec,double precision,integer,text) to anon,authenticated;
