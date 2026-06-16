-- FIX FINAL: Reset RLS and Permissions for User Access
-- This script is the "Nuclear Option" to guarantee user access.
-- It removes complex RLS and ensures basic Schema usage.

-- 1. Ensure Schema Usage (Again, explicitly)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- Grant basic CRUD to authenticated users on public tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- 2. Reset RLS on Profiles to be Non-Recursive and Permissive for SELECT
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to clear any hidden recursion or restriction
DROP POLICY IF EXISTS "Admins can see all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can see own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "allow_all" ON public.profiles;

-- 3. Create SIMPLE, ROBUST policies

-- Policy: Anyone (authenticated or not) can READ profiles.
-- This avoids "querying schema" errors during login when the session is establishing.
-- Since profiles usually contain name/avatar, this is standard practice.
CREATE POLICY "Public Read Access" ON public.profiles
  FOR SELECT USING (true);

-- Policy: Users can UPDATE their own profile
CREATE POLICY "Self Update Access" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can INSERT their own profile (failsafe)
CREATE POLICY "Self Insert Access" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Verify Admin Function Exists (for backend checks)
-- We keep the function, but don't use it in the SELECT policy anymore to avoid recursion risk.
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles 
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

grant execute on function public.is_admin to authenticated;
grant execute on function public.is_admin to anon;
