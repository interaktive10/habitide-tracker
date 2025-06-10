-- Check Current Database State
-- Run this in Supabase SQL Editor to see what exists

-- 1. Check which tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('profiles', 'action_types', 'actions');

-- 2. Check existing action_types data
SELECT id, name, value, category, is_default, user_id 
FROM action_types 
ORDER BY category, id;

-- 3. Check if profiles table has the right structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public';

-- 4. Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('profiles', 'action_types', 'actions')
ORDER BY tablename, policyname;

-- 5. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('profiles', 'action_types', 'actions'); 