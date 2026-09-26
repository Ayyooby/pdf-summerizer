-- Enable extension for embeddings
create extension if not exists vector;

-- Documents table
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  title text not null,
  file_path text not null,        -- path in Storage bucket
  page_count int,
  status text default 'uploaded', -- uploaded | processing | ready | failed
  error_message text,
  created_at timestamptz default now()
);

-- Chunks table (for RAG)
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  page_number int,
  chunk_index int,
  embedding vector(1536),  -- match your embedding model's dimension
  created_at timestamptz default now()
);

-- Vector similarity index
create index on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Summaries table
create table summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  style text default 'default', -- default | eli5 | academic | executive
  summary_text text,
  key_points jsonb,
  created_at timestamptz default now()
);

-- Flashcards table
create table flashcards (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  user_id uuid references auth.users(id) not null,
  question text not null,
  answer text not null,
  source_page int,
  difficulty text default 'medium',
  -- spaced repetition fields
  ease_factor float default 2.5,
  interval_days int default 1,
  next_review_at timestamptz default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- Chat messages table
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  user_id uuid references auth.users(id) not null,
  role text not null, -- 'user' | 'assistant'
  content text not null,
  cited_pages int[],
  created_at timestamptz default now()
);

alter table documents enable row level security;
alter table chunks enable row level security;
alter table summaries enable row level security;
alter table flashcards enable row level security;
alter table chat_messages enable row level security;

-- Users only see their own documents
create policy "Users manage own documents"
  on documents for all
  using (auth.uid() = user_id);

-- Chunks/summaries inherit access via document ownership
create policy "Users access chunks of own documents"
  on chunks for select
  using (
    document_id in (select id from documents where user_id = auth.uid())
  );

create policy "Users access summaries of own documents"
  on summaries for select
  using (
    document_id in (select id from documents where user_id = auth.uid())
  );

create policy "Users manage own flashcards"
  on flashcards for all
  using (auth.uid() = user_id);

create policy "Users manage own chat"
  on chat_messages for all
  using (auth.uid() = user_id);

-- Create bucket (via dashboard or SQL)
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

-- RLS on storage: users can only access their own folder (user_id/filename.pdf)
create policy "Users upload to own folder"
  on storage.objects for insert
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own files"
  on storage.objects for select
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Vector similarity query
create or replace function match_chunks(
  query_embedding vector(1536),
  match_document_id uuid,
  match_count int default 6
)
returns table (id uuid, content text, page_number int, similarity float)
language sql stable
as $$
  select id, content, page_number,
         1 - (embedding <=> query_embedding) as similarity
  from chunks
  where document_id = match_document_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
