-- Create table for shared map annotations
create table if not exists public.map_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  text text not null check (char_length(text) <= 280),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.map_annotations enable row level security;

-- Policies: authenticated users can read all, insert their own, delete their own
create policy "read_annotations" on public.map_annotations for select
  using (true);

create policy "insert_own_annotations" on public.map_annotations for insert
  with check (auth.uid() = user_id);

create policy "delete_own_annotations" on public.map_annotations for delete
  using (auth.uid() = user_id);

-- Index for spatial queries (simple btree on lat/lng for now)
create index if not exists map_annotations_lat_lng_idx on public.map_annotations (lat, lng);

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_map_annotations on public.map_annotations;
create trigger set_updated_at_map_annotations
before update on public.map_annotations
for each row execute function public.set_updated_at();

