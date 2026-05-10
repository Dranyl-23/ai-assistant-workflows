-- ============================================================
-- AI Assistant Workflow — Supabase Migration
-- Run this in the Supabase SQL Editor (safe to run multiple times)
-- ============================================================

-- 1. Enable pgvector
create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────
-- 2. document_chunks table
-- ─────────────────────────────────────────────────────────────
create table if not exists public.document_chunks (
    id          uuid        default gen_random_uuid() primary key,
    document_id uuid        not null references public.documents(id) on delete cascade,
    user_id     uuid        not null references auth.users(id) on delete cascade,
    chunk_text  text        not null,
    -- 384 dimensions — matches 'Xenova/all-MiniLM-L6-v2'
    embedding   vector(384) not null,
    created_at  timestamptz not null default timezone('utc', now())
);

create index if not exists document_chunks_embedding_idx
    on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────
-- 3. RLS for document_chunks
-- ─────────────────────────────────────────────────────────────
alter table public.document_chunks enable row level security;

drop policy if exists "Users can view their own document chunks" on public.document_chunks;
create policy "Users can view their own document chunks"
    on public.document_chunks for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own document chunks" on public.document_chunks;
create policy "Users can insert their own document chunks"
    on public.document_chunks for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own document chunks" on public.document_chunks;
create policy "Users can delete their own document chunks"
    on public.document_chunks for delete
    using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. match_document_chunks — vector similarity search
-- ─────────────────────────────────────────────────────────────
create or replace function match_document_chunks (
  query_embedding vector(384),
  match_threshold float,
  match_count     int,
  p_user_id       uuid
)
returns table (
  id          uuid,
  document_id uuid,
  chunk_text  text,
  similarity  float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.user_id = p_user_id
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. get_user_message_count — safe free-plan enforcement
-- ─────────────────────────────────────────────────────────────
-- FIX for Critical Issue #2:
-- Previously the backend built a comma-separated list of conversation IDs
-- in application code (SQL injection risk, breaks at scale).
-- This function does the count in a single safe JOIN on the DB side.
-- Called by chatOrchestrator.js → getUserMessageCount().
-- ─────────────────────────────────────────────────────────────
create or replace function get_user_message_count(p_user_id uuid)
returns bigint
language sql stable
security definer   -- bypasses RLS so supabaseAdmin can call it
as $$
  select count(m.id)
  from public.messages m
  inner join public.conversations c on c.id = m.conversation_id
  where c.user_id = p_user_id
    and m.role = 'user';
$$;

-- Grant execute permission to the Supabase service role
-- (the role used by supabaseAdmin in the backend)
grant execute on function get_user_message_count(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. OPTIONAL: credential_tokens table (production upgrade)
-- ─────────────────────────────────────────────────────────────
-- When you outgrow the in-memory token Map in services/n8n.js,
-- uncomment this block and update consumeCredentialToken() to query here.
-- ─────────────────────────────────────────────────────────────
-- create table if not exists public.credential_tokens (
--   token        text        primary key,
--   user_id      uuid        not null references auth.users(id) on delete cascade,
--   provider     text        not null,
--   expires_at   timestamptz not null,
--   used         boolean     not null default false,
--   created_at   timestamptz not null default now()
-- );
-- create index if not exists idx_credential_tokens_expires
--     on public.credential_tokens(expires_at);
--
-- -- Auto-clean expired tokens daily (requires pg_cron extension)
-- select cron.schedule(
--   'clean-credential-tokens',
--   '0 3 * * *',
--   $$ delete from public.credential_tokens where expires_at < now(); $$
-- );
