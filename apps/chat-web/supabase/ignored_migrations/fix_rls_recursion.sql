-- Fix Recursion in RLS Policies and Schema Permissions
-- Problem: The "Admins can see all profiles" policy was recursive, causing "Database error querying schema".
-- Solution: Use a SECURITY DEFINER function to break the recursion loop.

-- 1. Create a Security Definer function to check admin status
-- This runs with owner permissions, bypassing RLS to safely check the role.
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 
    from public.profiles 
    where id = auth.uid() 
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.is_admin to authenticated;
grant execute on function public.is_admin to anon;

-- 2. Fix RLS Policies on public.profiles
alter table public.profiles enable row level security;

-- Drop potentially problematic policies
drop policy if exists "Admins can see all profiles" on public.profiles;
drop policy if exists "Users can see own profile" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

-- Re-create safe policies

-- Policy A: Users can see their own profile
create policy "Users can see own profile" on public.profiles
  for select using (
    auth.uid() = id
  );

-- Policy B: Admins can see ALL profiles (uses the safe function)
create policy "Admins can see all profiles" on public.profiles
  for select using (
    public.is_admin()
  );

-- Policy C: Users can update their own profile
create policy "Users can update own profile" on public.profiles
  for update using (
    auth.uid() = id
  );

-- Policy D: Users can insert their own profile (needed for some flows, though RPC handles most)
create policy "Users can insert their own profile." on public.profiles
  for insert with check (
    auth.uid() = id
  );

-- 3. Re-assert Schema Permissions (Double check)
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
