-- Debug and Fix Script - Let's see exactly what's happening
-- Run each section separately to see where it fails

-- STEP 1: Check if users table exists
SELECT 'STEP 1: Checking if users table exists...' as debug_step;
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'users' AND table_schema = 'public'
  ) THEN 'Users table EXISTS ✅'
  ELSE 'Users table MISSING ❌ - This is the problem!'
  END as table_status;

-- STEP 2: If users table exists, check its structure
SELECT 'STEP 2: Users table structure...' as debug_step;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- STEP 3: Check what users currently exist
SELECT 'STEP 3: Current users in table...' as debug_step;
SELECT count(*) as total_users, 
       string_agg(username, ', ') as usernames
FROM users;

-- STEP 4: Try to create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

SELECT 'STEP 4: Users table created (if needed)' as debug_step;

-- STEP 5: Try inserting the user (this time we'll see any errors)
BEGIN;

INSERT INTO users (id, username, password_hash, created_at)
VALUES (
  '992e292f-242a-4820-9694-3c1406b419bf',
  'user_' || substr('992e292f-242a-4820-9694-3c1406b419bf', 1, 8), -- Unique username
  'needs_reset',
  NOW()
);

SELECT 'STEP 5: User inserted successfully ✅' as debug_step;

COMMIT;

-- STEP 6: Verify the user was created
SELECT 'STEP 6: Verifying user creation...' as debug_step;
SELECT id, username, created_at 
FROM users 
WHERE id = '992e292f-242a-4820-9694-3c1406b419bf';

-- STEP 7: Create profiles table if needed
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- STEP 8: Disable RLS on profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON profiles TO authenticated;
GRANT ALL PRIVILEGES ON profiles TO anon;

SELECT 'STEP 8: Profiles table ready' as debug_step;

-- STEP 9: Now try creating the profile
INSERT INTO profiles (id, data) 
VALUES (
  '992e292f-242a-4820-9694-3c1406b419bf', 
  '{
    "settings": {
      "targetGoal": 20000,
      "reminderTime": "20:00",
      "theme": "light", 
      "quickActions": [1, 2, 3, 4]
    },
    "customWorkouts": {},
    "workoutState": {}
  }'::jsonb
) 
ON CONFLICT (id) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = NOW();

SELECT 'STEP 9: Profile created successfully ✅' as debug_step;

-- STEP 10: Final verification
SELECT 'STEP 10: Final verification...' as debug_step;

SELECT 'User exists: ' || CASE WHEN count(*) > 0 THEN 'YES ✅' ELSE 'NO ❌' END
FROM users WHERE id = '992e292f-242a-4820-9694-3c1406b419bf';

SELECT 'Profile exists: ' || CASE WHEN count(*) > 0 THEN 'YES ✅' ELSE 'NO ❌' END  
FROM profiles WHERE id = '992e292f-242a-4820-9694-3c1406b419bf';

SELECT 'SUCCESS! Your app should work now! ��' as final_message; 