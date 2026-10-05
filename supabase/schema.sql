-- Сарфа — схема базы данных для Supabase.
-- Вставьте целиком в SQL Editor → New query → Run. Повторный запуск безопасен.

-- Каждому пользователю принадлежит одна строка с его бюджетом.
create table if not exists public.budgets (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  state      jsonb       not null,
  rev        bigint      not null default 1,
  updated_at timestamptz not null default now(),
  constraint budgets_state_size check (octet_length(state::text) < 2000000)
);

-- Row Level Security: база сама не отдаёт чужие строки, даже если клиент попросит.
alter table public.budgets enable row level security;

revoke all on public.budgets from anon, public;
grant select, insert, update, delete on public.budgets to authenticated;

drop policy if exists budgets_select_own on public.budgets;
drop policy if exists budgets_insert_own on public.budgets;
drop policy if exists budgets_update_own on public.budgets;
drop policy if exists budgets_delete_own on public.budgets;

create policy budgets_select_own on public.budgets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy budgets_insert_own on public.budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy budgets_update_own on public.budgets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budgets_delete_own on public.budgets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Время последнего сохранения ставит сервер.
create or replace function public.budgets_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists budgets_touch on public.budgets;
create trigger budgets_touch before update on public.budgets
  for each row execute function public.budgets_touch();

-- Пользователь может удалить свой аккаунт вместе со всеми данными (кнопка в Настройках).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
