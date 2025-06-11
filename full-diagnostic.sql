-- Full Diagnostic Script for Habitide Database Issues
-- Run this in Supabase SQL Editor to diagnose the 406 error

SELECT '=== TABLE EXISTENCE CHECK ===' as diagnostic_step;

-- Check if tables exist and their structure
SELECT 
  'Table: ' || table_name || ' (Type: ' || table_type || ')' as table_info
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'profiles', 'action_types', 'actions')
ORDER BY table_name;

SELECT '=== PROFILES TABLE STRUCTURE ===' as diagnostic_step;

-- Check profiles table structure
SELECT 
  'Column: ' || column_name || ' (Type: ' || data_type || ', Nullable: ' || is_nullable || ')' as column_info
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT '=== ROW LEVEL SECURITY STATUS ===' as diagnostic_step;

-- Check RLS status
SELECT 
  schemaname, 
  tablename, 
  CASE WHEN rowsecurity THEN 'RLS ENABLED ❌' ELSE 'RLS DISABLED ✅' END as rls_status
FROM pg_tables 
WHERE tablename IN ('users', 'profiles', 'action_types', 'actions')
ORDER BY tablename;

SELECT '=== EXISTING POLICIES ===' as diagnostic_step;

-- Check existing policies
SELECT 
  'Policy: ' || policyname || ' on ' || tablename || ' (Command: ' || cmd || ')' as policy_info
FROM pg_policies 
WHERE tablename IN ('users', 'profiles', 'action_types', 'actions')
ORDER BY tablename, policyname;

SELECT '=== TABLE PERMISSIONS ===' as diagnostic_step;

-- Check permissions for profiles table
SELECT 
  'Permission: ' || grantee || ' can ' || privilege_type || ' on ' || table_name as permission_info
FROM information_schema.role_table_grants 
WHERE table_name = 'profiles'
ORDER BY grantee, privilege_type;

SELECT '=== USER DATA CHECK ===' as diagnostic_step;

-- Check if the specific user exists in users table
SELECT 
  'User exists in users table: ' || CASE WHEN count(*) > 0 THEN 'YES ✅' ELSE 'NO ❌' END as user_status
FROM users 
WHERE id = '992e292f-242a-4820-9694-3c1406b419bf';

-- Check if user has a profile record
SELECT 
  'User has profile record: ' || CASE WHEN count(*) > 0 THEN 'YES ✅' ELSE 'NO ❌' END as profile_status
FROM profiles 
WHERE id = '992e292f-242a-4820-9694-3c1406b419bf';

SELECT '=== ACTION TYPES CHECK ===' as diagnostic_step;

-- Check action types count
SELECT 
  'Total action types: ' || count(*)::text as action_types_total
FROM action_types;

SELECT 
  'Default action types: ' || count(*)::text as default_action_types
FROM action_types 
WHERE user_id IS NULL;

SELECT '=== DETAILED PROFILE DATA ===' as diagnostic_step;

-- Show profile data if it exists
SELECT 
  id,
  data,
  created_at,
  updated_at
FROM profiles 
WHERE id = '992e292f-242a-4820-9694-3c1406b419bf';

SELECT '=== DATABASE CONSTRAINTS ===' as diagnostic_step;

-- Check foreign key constraints
SELECT 
  'Constraint: ' || conname || ' on ' || conrelid::regclass::text as constraint_info
FROM pg_constraint 
WHERE conrelid IN ('profiles'::regclass, 'actions'::regclass, 'action_types'::regclass)
  AND contype = 'f';

SELECT '=== DIAGNOSTIC COMPLETE ===' as diagnostic_step;

-- Final summary
SELECT 
  'Diagnostic completed at: ' || now()::text as completion_time; 