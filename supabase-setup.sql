-- Habitide Database Setup Script
-- Run this in your Supabase SQL Editor

-- 1. Create profiles table for storing user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create action_types table for action definitions
CREATE TABLE IF NOT EXISTS action_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  value INTEGER NOT NULL,
  category TEXT CHECK (category IN ('positive', 'negative')) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create actions table for user actions
CREATE TABLE IF NOT EXISTS actions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type_id INTEGER REFERENCES action_types(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  notes TEXT DEFAULT '',
  value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies

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

-- 6. Insert default action types
INSERT INTO action_types (name, value, category, is_default) VALUES
-- Positive actions (debt reduction)
('Workout/Exercise', 2000, 'positive', true),
('Debt Payment', 5000, 'positive', true),
('Healthy Meal', 1000, 'positive', true),
('Meditation', 2000, 'positive', true),
('Early Sleep', 2000, 'positive', true),
('Learning', 2000, 'positive', true),
('See sunrise', 5000, 'positive', true),
('Reading', 2000, 'positive', true),

-- Negative actions (debt increase)
('Junk Food', -2000, 'negative', true),
('Skipped Workout', -3000, 'negative', true),
('Porn', -5000, 'negative', true),
('Impulse Purchase', -3000, 'negative', true),
('Procrastination', -5000, 'negative', true),
('Miss sunrise', -10000, 'negative', true),
('Overtrading', -10000, 'negative', true),
('Bad financial decision', -10000, 'negative', true);

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_date ON actions(date);
CREATE INDEX IF NOT EXISTS idx_action_types_user_id ON action_types(user_id);
CREATE INDEX IF NOT EXISTS idx_action_types_default ON action_types(is_default);

-- 8. Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Create trigger for profiles table
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Create a view for easier action queries with action type details
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