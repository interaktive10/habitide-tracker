-- Complete Action Types Cleanup and Migration
-- This will remove ALL existing action types and replace with the new 16

-- Step 1: Delete ALL existing action types (both default and user-specific)
-- Note: This will also delete any user actions associated with these types
DELETE FROM actions; -- Remove all user actions first (to avoid foreign key constraints)
DELETE FROM action_types; -- Remove all action types

-- Step 2: Reset the action_types ID sequence
ALTER SEQUENCE action_types_id_seq RESTART WITH 1;

-- Step 3: Insert ONLY the new 16 action types as defaults
INSERT INTO action_types (name, value, category, is_default, user_id) VALUES
-- Positive actions (8)
('Workout/Exercise', 2000, 'positive', true, null),
('Debt Payment', 5000, 'positive', true, null),
('Healthy Meal', 1000, 'positive', true, null),
('Meditation', 2000, 'positive', true, null),
('Early Sleep', 2000, 'positive', true, null),
('Learning', 2000, 'positive', true, null),
('See sunrise', 5000, 'positive', true, null),
('Reading', 2000, 'positive', true, null),

-- Negative actions (8)
('Junk Food', -2000, 'negative', true, null),
('Skipped Workout', -3000, 'negative', true, null),
('Porn', -5000, 'negative', true, null),
('Impulse Purchase', -3000, 'negative', true, null),
('Procrastination', -5000, 'negative', true, null),
('Miss sunrise', -10000, 'negative', true, null),
('Overtrading', -10000, 'negative', true, null),
('Bad financial decision', -10000, 'negative', true, null);

-- Step 4: Verify the results
SELECT 'Total action types:' as info, COUNT(*) as count FROM action_types
UNION ALL
SELECT 'Positive actions:' as info, COUNT(*) as count FROM action_types WHERE category = 'positive'
UNION ALL  
SELECT 'Negative actions:' as info, COUNT(*) as count FROM action_types WHERE category = 'negative';

-- Step 5: Show all action types
SELECT id, name, value, category, is_default FROM action_types ORDER BY category, value DESC; 