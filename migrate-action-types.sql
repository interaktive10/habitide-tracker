-- Migration Script: Update Action Types to New List
-- Run this in your Supabase SQL Editor

-- Step 1: Delete all existing default action types
DELETE FROM action_types WHERE is_default = true;

-- Step 2: Insert the new 16 action types
INSERT INTO action_types (name, value, category, is_default, user_id) VALUES
-- Positive actions
('Workout/Exercise', 2000, 'positive', true, null),
('Debt Payment', 5000, 'positive', true, null),
('Healthy Meal', 1000, 'positive', true, null),
('Meditation', 2000, 'positive', true, null),
('Early Sleep', 2000, 'positive', true, null),
('Learning', 2000, 'positive', true, null),
('See sunrise', 5000, 'positive', true, null),
('Reading', 2000, 'positive', true, null),

-- Negative actions
('Junk Food', -2000, 'negative', true, null),
('Skipped Workout', -3000, 'negative', true, null),
('Porn', -5000, 'negative', true, null),
('Impulse Purchase', -3000, 'negative', true, null),
('Procrastination', -5000, 'negative', true, null),
('Miss sunrise', -10000, 'negative', true, null),
('Overtrading', -10000, 'negative', true, null),
('Bad financial decision', -10000, 'negative', true, null);

-- Step 3: Verify the changes
SELECT name, value, category, is_default FROM action_types WHERE is_default = true ORDER BY category, name; 