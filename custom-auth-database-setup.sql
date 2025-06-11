-- Custom Authentication Compatible Database Setup
-- This setup works with custom username/password auth instead of Supabase auth
-- Run this in your Supabase SQL Editor

-- 1. Create users table for custom authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create profiles table for user settings (no auth.uid() dependency)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create action_types table 
CREATE TABLE IF NOT EXISTS action_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  value INTEGER NOT NULL,
  category TEXT CHECK (category IN ('positive', 'negative')) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Create actions table
CREATE TABLE IF NOT EXISTS actions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  action_type_id INTEGER REFERENCES action_types(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  notes TEXT DEFAULT '',
  value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. DISABLE RLS (since we're using custom auth, not Supabase auth)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE action_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE actions DISABLE ROW LEVEL SECURITY;

-- 6. Drop any existing RLS policies (they won't work with custom auth)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view action types" ON action_types;
DROP POLICY IF EXISTS "Users can insert own action types" ON action_types;
DROP POLICY IF EXISTS "Users can update own action types" ON action_types;
DROP POLICY IF EXISTS "Users can delete own action types" ON action_types;
DROP POLICY IF EXISTS "Users can view own actions" ON actions;
DROP POLICY IF EXISTS "Users can insert own actions" ON actions;
DROP POLICY IF EXISTS "Users can update own actions" ON actions;
DROP POLICY IF EXISTS "Users can delete own actions" ON actions;

-- 7. Insert 16 default action types (only if they don't already exist)
INSERT INTO action_types (name, value, category, is_default, user_id) 
SELECT name, value, category, is_default, user_id
FROM (VALUES
  -- Positive actions (debt reduction)
  ('Workout/Exercise', 2000, 'positive', true, null),
  ('Debt Payment', 5000, 'positive', true, null),
  ('Healthy Meal', 1000, 'positive', true, null),
  ('Meditation', 2000, 'positive', true, null),
  ('Early Sleep', 2000, 'positive', true, null),
  ('Learning', 2000, 'positive', true, null),
  ('See sunrise', 5000, 'positive', true, null),
  ('Reading', 2000, 'positive', true, null),

  -- Negative actions (debt increase)
  ('Junk Food', -2000, 'negative', true, null),
  ('Skipped Workout', -3000, 'negative', true, null),
  ('Porn', -5000, 'negative', true, null),
  ('Impulse Purchase', -3000, 'negative', true, null),
  ('Procrastination', -5000, 'negative', true, null),
  ('Miss sunrise', -10000, 'negative', true, null),
  ('Overtrading', -10000, 'negative', true, null),
  ('Bad financial decision', -10000, 'negative', true, null)
) AS v(name, value, category, is_default, user_id)
WHERE NOT EXISTS (
  SELECT 1 FROM action_types 
  WHERE action_types.name = v.name 
    AND action_types.category = v.category 
    AND (action_types.is_default = true OR action_types.user_id IS NULL)
);

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_date ON actions(date);
CREATE INDEX IF NOT EXISTS idx_action_types_user_id ON action_types(user_id);
CREATE INDEX IF NOT EXISTS idx_action_types_default ON action_types(is_default);

-- 9. Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 10. Create trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 11. Grant permissions to authenticated role (for API access)
GRANT ALL ON users TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON action_types TO authenticated;
GRANT ALL ON actions TO authenticated;
GRANT USAGE ON SEQUENCE action_types_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE actions_id_seq TO authenticated;

-- 12. Also grant to anon role for sign-up
GRANT INSERT ON users TO anon;
GRANT SELECT ON users TO anon;

-- 13. Create a view for easier action queries with action type details
CREATE OR REPLACE VIEW user_actions_with_types AS
SELECT 
  a.id,
  a.user_id,
  a.action_type_id,
  a.date,
  a.notes,
  a.value,
  a.created_at,
  at.name as action_type_name,
  at.category as action_type_category
FROM actions a
JOIN action_types at ON a.action_type_id = at.id;

-- Grant access to the view
GRANT SELECT ON user_actions_with_types TO authenticated;
GRANT SELECT ON user_actions_with_types TO anon;

-- 14. Clean up any duplicate default action types (if any exist)
DELETE FROM action_types 
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY name, category 
             ORDER BY 
               CASE WHEN is_default = true THEN 1 ELSE 2 END,
               CASE WHEN user_id IS NULL THEN 1 ELSE 2 END,
               id
           ) as rn
    FROM action_types
    WHERE is_default = true OR user_id IS NULL
  ) ranked
  WHERE rn > 1
);

-- Verification queries (run these to check everything is set up correctly)
-- SELECT 'Users table' as table_name, count(*) as record_count FROM users
-- UNION ALL
-- SELECT 'Profiles table', count(*) FROM profiles  
-- UNION ALL
-- SELECT 'Action types table', count(*) FROM action_types
-- UNION ALL  
-- SELECT 'Actions table', count(*) FROM actions;

-- SELECT name, category, value, is_default FROM action_types WHERE is_default = true ORDER BY category, name; 