-- Safe Migration: Preserve user actions, clean up action types
-- This attempts to preserve existing user actions by mapping them to new types

-- Step 1: Create a temporary mapping table
CREATE TEMP TABLE action_mapping AS
SELECT 
  id as old_id,
  CASE 
    WHEN name ILIKE '%workout%' OR name ILIKE '%exercise%' OR name ILIKE '%gym%' THEN 'Workout/Exercise'
    WHEN name ILIKE '%debt%' OR name ILIKE '%payment%' THEN 'Debt Payment'
    WHEN name ILIKE '%healthy%meal%' OR name ILIKE '%meal%' THEN 'Healthy Meal'
    WHEN name ILIKE '%meditation%' THEN 'Meditation'
    WHEN name ILIKE '%sleep%' THEN 'Early Sleep'
    WHEN name ILIKE '%learn%' OR name ILIKE '%study%' THEN 'Learning'
    WHEN name ILIKE '%sunrise%' THEN 'See sunrise'
    WHEN name ILIKE '%read%' THEN 'Reading'
    WHEN name ILIKE '%junk%' OR name ILIKE '%fast%food%' THEN 'Junk Food'
    WHEN name ILIKE '%skip%workout%' THEN 'Skipped Workout'
    WHEN name ILIKE '%porn%' THEN 'Porn'
    WHEN name ILIKE '%impulse%' OR name ILIKE '%shopping%' THEN 'Impulse Purchase'
    WHEN name ILIKE '%procrastin%' THEN 'Procrastination'
    WHEN name ILIKE '%miss%sunrise%' THEN 'Miss sunrise'
    WHEN name ILIKE '%trading%' THEN 'Overtrading'
    WHEN name ILIKE '%financial%' THEN 'Bad financial decision'
    ELSE NULL
  END as new_name
FROM action_types;

-- Step 2: Delete all action types
DELETE FROM action_types;

-- Step 3: Insert the new 16 action types
INSERT INTO action_types (id, name, value, category, is_default, user_id) VALUES
(1, 'Workout/Exercise', 2000, 'positive', true, null),
(2, 'Debt Payment', 5000, 'positive', true, null),
(3, 'Healthy Meal', 1000, 'positive', true, null),
(4, 'Meditation', 2000, 'positive', true, null),
(5, 'Early Sleep', 2000, 'positive', true, null),
(6, 'Learning', 2000, 'positive', true, null),
(7, 'See sunrise', 5000, 'positive', true, null),
(8, 'Reading', 2000, 'positive', true, null),
(9, 'Junk Food', -2000, 'negative', true, null),
(10, 'Skipped Workout', -3000, 'negative', true, null),
(11, 'Porn', -5000, 'negative', true, null),
(12, 'Impulse Purchase', -3000, 'negative', true, null),
(13, 'Procrastination', -5000, 'negative', true, null),
(14, 'Miss sunrise', -10000, 'negative', true, null),
(15, 'Overtrading', -10000, 'negative', true, null),
(16, 'Bad financial decision', -10000, 'negative', true, null);

-- Step 4: Update existing actions to point to new action type IDs
UPDATE actions 
SET action_type_id = (
  SELECT at.id 
  FROM action_types at 
  JOIN action_mapping am ON at.name = am.new_name 
  WHERE am.old_id = actions.action_type_id
)
WHERE action_type_id IN (SELECT old_id FROM action_mapping WHERE new_name IS NOT NULL);

-- Step 5: Delete actions that couldn't be mapped
DELETE FROM actions 
WHERE action_type_id NOT IN (SELECT id FROM action_types);

-- Step 6: Reset sequence
SELECT setval('action_types_id_seq', 16);

-- Step 7: Verify results
SELECT 'Action types count:' as info, COUNT(*) as count FROM action_types
UNION ALL
SELECT 'Actions count:' as info, COUNT(*) as count FROM actions; 