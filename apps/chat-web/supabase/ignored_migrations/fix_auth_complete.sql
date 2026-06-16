-- FIX AUTH SYSTEM COMPLETE (V6)
-- This script performs a full reset of the critical auth components to resolve "Database error querying schema".

-- SECTION 1: SCHEMA PERMISSIONS (The most likely culprit)
-- We grant excessive permissions temporarily to ensure it's not a blockage.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- Authenticated users need to interact with the public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- SECTION 2: REMOVE POTENTIALLY CONFLICTING TRIGGERS
-- Triggers on auth.users can fail silently or with generic errors. 
-- Since we use RPC for creation, we don't strictly need them for admin-created users.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- SECTION 3: TABLE STRUCTURE & CONSTRAINTS
-- Ensure profiles table exists and has the correct Foreign Key for CASCADE DELETION
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamp with time zone,
  full_name text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email text
);

-- SECTION 4: RESET RLS POLICIES (Simplify to avoid recursion)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Admins can see all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can see own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Public Read Access" ON public.profiles;
DROP POLICY IF EXISTS "Self Update Access" ON public.profiles;
DROP POLICY IF EXISTS "Self Insert Access" ON public.profiles;

-- CREATE NON-RECURSIVE POLICIES
-- 1. Read: Allow everyone to read profiles. This prevents login errors when fetching profile.
CREATE POLICY "Public Read Access" ON public.profiles
  FOR SELECT USING (true);

-- 2. Update: Users can update their own profile.
CREATE POLICY "Self Update Access" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 3. Insert: Users can insert their own profile (fallback).
CREATE POLICY "Self Insert Access" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Delete: Users can delete their own profile (though usually done via cascade).
CREATE POLICY "Self Delete Access" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- SECTION 5: ADMIN FUNCTIONS (RPCs)

-- 5.1. Check Admin (Helper)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Uses a direct query, bypassing RLS to avoid recursion
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2. Create User By Admin (Robust V6)
CREATE OR REPLACE FUNCTION public.create_user_by_admin(email text, password text, full_name text)
RETURNS uuid AS $$
DECLARE
  new_id uuid;
  admin_instance_id uuid;
BEGIN
  -- Check admin permissions
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem criar usuários.';
  END IF;

  -- Attempt to get instance_id (needed for some Supabase setups)
  SELECT instance_id INTO admin_instance_id FROM auth.users WHERE id = auth.uid();
  IF admin_instance_id IS NULL THEN
     SELECT instance_id INTO admin_instance_id FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1;
  END IF;
  
  new_id := gen_random_uuid();

  -- Insert into auth.users
  -- We avoid 'confirmed_at' column to prevent "generated column" errors.
  INSERT INTO auth.users (
    id, 
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data,
    raw_user_meta_data, 
    aud, 
    role,
    created_at,
    updated_at,
    last_sign_in_at,
    is_super_admin
  )
  VALUES (
    new_id,
    admin_instance_id,
    email,
    crypt(password, gen_salt('bf')),
    now(), 
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('full_name', full_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    now(),
    false
  );

  -- Insert into auth.identities (CRITICAL for login)
  INSERT INTO auth.identities (
    id, 
    user_id, 
    identity_data, 
    provider, 
    provider_id, 
    last_sign_in_at, 
    created_at, 
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    new_id,
    jsonb_build_object('sub', new_id, 'email', email),
    'email',
    email,
    now(),
    now(),
    now()
  );

  -- Insert into public.profiles (CRITICAL for app logic)
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (new_id, full_name, email, 'user')
  ON CONFLICT (id) DO UPDATE
  SET full_name = excluded.full_name,
      email = excluded.email,
      role = excluded.role;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.3. Delete User By Admin
-- This relies on ON DELETE CASCADE on public.profiles
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Check admin permissions
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem deletar usuários.';
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode deletar sua própria conta.';
  END IF;

  -- Delete from auth.users (Cascade will handle public.profiles)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECTION 6: FINAL PERMISSIONS
GRANT EXECUTE ON FUNCTION public.create_user_by_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon;

