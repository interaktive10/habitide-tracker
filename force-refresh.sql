-- Force refresh action types - Simple verification and cleanup
-- Run this to check and fix action types

-- First, let's see what's currently in the database
SELECT 'Current action types in database:' as status;
SELECT id, name, value, category, is_default, 
       CASE WHEN user_id IS NULL THEN 'Global' ELSE 'User-specific' END as scope
FROM action_types 
ORDER BY category, name;

-- Count by category
SELECT 'Action type counts:' as status;
SELECT category, COUNT(*) as count 
FROM action_types 
GROUP BY category
UNION ALL
SELECT 'TOTAL' as category, COUNT(*) as count FROM action_types;

If you see more than 16 action types or wrong ones, run this cleanup:
(Uncomment the lines below by removing the -- at the start)

DELETE FROM actions; -- Clear all actions to avoid foreign key issues
DELETE FROM action_types; -- Clear all action types
ALTER SEQUENCE action_types_id_seq RESTART WITH 1; -- Reset ID counter

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