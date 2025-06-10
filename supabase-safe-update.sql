-- Safe Habitide Database Update Script
-- This script handles existing tables and policies gracefully

-- 1. Create tables only if they don't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS action_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  value INTEGER NOT NULL,
  category TEXT CHECK (category IN ('positive', 'negative')) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS actions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type_id INTEGER REFERENCES action_types(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  notes TEXT DEFAULT '',
  value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add data column to profiles if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='data') THEN
        ALTER TABLE profiles ADD COLUMN data JSONB DEFAULT '{}';
    END IF;
    
    -- Add updated_at to profiles if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='updated_at') THEN
        ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
    END IF;
    
    -- Add is_default to action_types if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='action_types' AND column_name='is_default') THEN
        ALTER TABLE action_types ADD COLUMN is_default BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add user_id to action_types if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='action_types' AND column_name='user_id') THEN
        ALTER TABLE action_types ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies before recreating (to avoid conflicts)
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

-- 5. Create fresh policies
-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Action types policies
CREATE POLICY "Users can view action types" ON action_types
  FOR SELECT USING (is_default = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own action types" ON action_types
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own action types" ON action_types
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own action types" ON action_types
  FOR DELETE USING (auth.uid() = user_id);

-- Actions policies
CREATE POLICY "Users can view own actions" ON actions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own actions" ON actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own actions" ON actions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own actions" ON actions
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Insert default action types only if they don't exist
INSERT INTO action_types (name, value, category, is_default, user_id) 
SELECT * FROM (VALUES
  ('Workout/Exercise', 2000, 'positive', true, auth.uid()),
  ('Debt Payment', 5000, 'positive', true, auth.uid()),
  ('Healthy Meal', 1000, 'positive', true, auth.uid()),
  ('Meditation', 2000, 'positive', true, auth.uid()),
  ('Early Sleep', 2000, 'positive', true, auth.uid()),
  ('Learning', 2000, 'positive', true, auth.uid()),
  ('See sunrise', 5000, 'positive', true, auth.uid()),
  ('Reading', 2000, 'positive', true, auth.uid()),
  ('Junk Food', -2000, 'negative', true, auth.uid()),
  ('Skipped Workout', -3000, 'negative', true, auth.uid()),
  ('Porn', -5000, 'negative', true, auth.uid()),
  ('Impulse Purchase', -3000, 'negative', true, auth.uid()),
  ('Procrastination', -5000, 'negative', true, auth.uid()),
  ('Miss sunrise', -10000, 'negative', true, auth.uid()),
  ('Overtrading', -10000, 'negative', true, auth.uid()),
  ('Bad financial decision', -10000, 'negative', true, auth.uid())
) AS v(name, value, category, is_default, user_id)
WHERE NOT EXISTS (
  SELECT 1 FROM action_types 
  WHERE action_types.name = v.name 
  AND action_types.is_default = true 
  AND action_types.user_id = auth.uid()
);

-- 7. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_date ON actions(date);
CREATE INDEX IF NOT EXISTS idx_action_types_user_id ON action_types(user_id);
CREATE INDEX IF NOT EXISTS idx_action_types_default ON action_types(is_default);

-- 8. Create or replace update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Create or replace view
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