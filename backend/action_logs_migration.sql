-- ─────────────────────────────────────────────────────────────
-- ACTION LOGS MIGRATION
-- ─────────────────────────────────────────────────────────────

create table if not exists public.action_logs (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    provider    text not null,
    action      text not null,
    status      text not null, -- 'success' or 'error'
    details     jsonb,
    created_at  timestamptz not null default now()
);

-- Enable RLS
alter table public.action_logs enable row level security;

-- Policies
drop policy if exists "Users can view their own action logs" on public.action_logs;
create policy "Users can view their own action logs"
    on public.action_logs for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own action logs" on public.action_logs;
create policy "Users can insert their own action logs"
    on public.action_logs for insert
    with check (auth.uid() = user_id);

-- Create index for faster sorting by recent
create index if not exists idx_action_logs_user_created 
    on public.action_logs(user_id, created_at desc);
