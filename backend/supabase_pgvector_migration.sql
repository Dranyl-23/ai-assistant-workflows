-- 1. Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- 2. Create the document_chunks table to store pieces of documents and their embeddings
create table if not exists public.document_chunks (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    chunk_text text not null,
    -- We use 384 dimensions because we will use the 'Xenova/all-MiniLM-L6-v2' local embedding model
    embedding vector(384) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create an index for faster similarity searches (using cosine distance)
create index if not exists document_chunks_embedding_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- 4. Enable Row Level Security (RLS) so users can only access their own chunks
alter table public.document_chunks enable row level security;

create policy "Users can view their own document chunks"
    on public.document_chunks for select
    using (auth.uid() = user_id);

create policy "Users can insert their own document chunks"
    on public.document_chunks for insert
    with check (auth.uid() = user_id);

create policy "Users can delete their own document chunks"
    on public.document_chunks for delete
    using (auth.uid() = user_id);

-- 5. Create the match_document_chunks function to perform similarity search
create or replace function match_document_chunks (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  chunk_text text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.chunk_text,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.user_id = p_user_id
    and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
