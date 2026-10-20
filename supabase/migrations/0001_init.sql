-- Notes schema for Supabase Free.
-- Run this once in the Supabase SQL Editor (Dashboard → SQL → New query).
-- It creates private tables, row level security, search, and a private storage bucket.
-- Safe to re-run: existing tables are left in place and policies are replaced.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  subject text not null default '',
  color text not null default '#0f6e6b',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.folders (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.notebooks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null,
  description text not null default '',
  color text not null default '#0f6e6b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.sections (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  parent_id uuid references public.sections (id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.documents (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  notebook_id uuid references public.notebooks (id) on delete set null,
  title text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 52428800),
  storage_path text,
  kind text not null,
  extracted_text text not null default '',
  pages jsonb not null default '[]'::jsonb,
  extraction_status text not null default 'pending',
  extraction_error text,
  upload_status text not null default 'pending',
  upload_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  notebook_id uuid references public.notebooks (id) on delete set null,
  section_id uuid references public.sections (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null default 'Untitled',
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  content_text text not null default '',
  word_count integer not null default 0,
  template_type text,
  source_document_id uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.tags (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#78716c',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table if not exists public.note_tags (
  id uuid primary key,
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (note_id, tag_id)
);

create table if not exists public.recordings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  notebook_id uuid references public.notebooks (id) on delete set null,
  title text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 52428800),
  duration_seconds numeric not null default 0,
  storage_path text,
  upload_status text not null default 'pending',
  upload_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.transcripts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  recording_id uuid not null references public.recordings (id) on delete cascade,
  content text not null default '',
  segments jsonb not null default '[]'::jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.drawings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  notebook_id uuid references public.notebooks (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  title text not null,
  pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.pdf_annotations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  page_number integer not null check (page_number > 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (document_id, page_number)
);

create table if not exists public.favorites (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, target_type, target_id)
);

create table if not exists public.sync_metadata (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  local_updated_at timestamptz,
  remote_updated_at timestamptz,
  sync_status text not null default 'synced',
  last_error text,
  updated_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notes' and column_name = 'search_vector'
  ) then
    alter table public.notes
      add column search_vector tsvector
      generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_text, ''))) stored;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'search_vector'
  ) then
    alter table public.documents
      add column search_vector tsvector
      generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(extracted_text, ''))) stored;
  end if;
end $$;

create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_notebook_idx on public.notes (notebook_id);
create index if not exists notes_class_idx on public.notes (class_id);
create index if not exists notes_search_idx on public.notes using gin (search_vector);
create index if not exists documents_user_updated_idx on public.documents (user_id, updated_at desc);
create index if not exists documents_search_idx on public.documents using gin (search_vector);
create index if not exists notebooks_user_idx on public.notebooks (user_id, updated_at desc);
create index if not exists classes_user_idx on public.classes (user_id, updated_at desc);
create index if not exists recordings_user_idx on public.recordings (user_id, updated_at desc);
create index if not exists drawings_user_idx on public.drawings (user_id, updated_at desc);
create index if not exists folders_parent_idx on public.folders (parent_id);
create index if not exists sections_notebook_idx on public.sections (notebook_id, position);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'notes'), '@', 1))
  )
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.search_content(search_query text)
returns table (kind text, id uuid, title text, snippet text, updated_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select 'note'::text, n.id, n.title, left(n.content_text, 180), n.updated_at
  from public.notes n
  where n.user_id = auth.uid()
    and n.deleted_at is null
    and n.search_vector @@ websearch_to_tsquery('english', search_query)
  union all
  select 'document'::text, d.id, d.title, left(d.extracted_text, 180), d.updated_at
  from public.documents d
  where d.user_id = auth.uid()
    and d.deleted_at is null
    and d.search_vector @@ websearch_to_tsquery('english', search_query);
$$;

revoke all on function public.search_content(text) from public, anon;
grant execute on function public.search_content(text) to authenticated;

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'classes', 'folders', 'notebooks', 'sections', 'notes', 'tags', 'note_tags',
    'documents', 'recordings', 'transcripts', 'drawings', 'pdf_annotations',
    'favorites', 'sync_metadata'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_select', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_insert', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_update', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_delete', tbl);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', tbl || '_select', tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', tbl || '_insert', tbl);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', tbl || '_update', tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', tbl || '_delete', tbl);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files',
  'files',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/x-m4a',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800;

drop policy if exists files_select_own on storage.objects;
drop policy if exists files_insert_own on storage.objects;
drop policy if exists files_update_own on storage.objects;
drop policy if exists files_delete_own on storage.objects;

create policy files_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy files_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy files_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy files_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
