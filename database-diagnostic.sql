-- Database Diagnostic Script
-- Run this in Supabase SQL Editor to check current state

-- 1. Check which tables exist
SELECT 
  'Table exists: ' || table_name as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'profiles', 'action_types', 'actions')
ORDER BY table_name;

-- 2. Check profiles table structure
SELECT 
  'profiles column: ' || column_name || ' (' || data_type || ')' as structure
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check RLS status
SELECT 
  schemaname, 
  tablename, 
  CASE WHEN rowsecurity THEN 'RLS ENABLED' ELSE 'RLS DISABLED' END as rls_status
FROM pg_tables 
WHERE tablename IN ('users', 'profiles', 'action_types', 'actions')
ORDER BY tablename;

-- 4. Check existing policies
SELECT 
  'Policy: ' || policyname || ' on ' || tablename || ' (' || cmd || ')' as policies
FROM pg_policies 
WHERE tablename IN ('users', 'profiles', 'action_types', 'actions')
ORDER BY tablename, policyname;

-- 5. Check default action types
SELECT 
  'Default action type: ' || name || ' (' || category || ', ' || value || ')' as defaults
FROM action_types 
WHERE is_default = true OR user_id IS NULL
ORDER BY category, name;

-- 6. Check if any users exist
SELECT 
  'User count: ' || count(*)::text as user_info
FROM users;

-- 7. Check if any profiles exist  
SELECT 
  'Profile count: ' || count(*)::text as profile_info
FROM profiles; 