# Habitide Tracker - Architecture Analysis & Problem Resolution

## Current Status Summary
- ✅ **Authentication**: Working (user ID: `992e292f-242a-4820-9694-3c1406b419bf`)
- ✅ **Action Types**: Loading successfully (16 types: 8 positive, 8 negative)
- ❌ **Profiles**: 406 Error (Not Acceptable)
- ❌ **Settings**: Not loading due to profiles error
- ✅ **Dashboard**: Renders but with default data only

## Architecture Overview

### Current Authentication System
**Type**: Custom Username/Password Authentication
- **Users Table**: Stores username/password_hash with UUID primary keys
- **Session Storage**: localStorage (`habitide-user`)
- **Verification**: Database lookup on each session check

### Database Schema Requirements

#### 1. **users** table (Authentication)
```sql
users (
  id UUID PRIMARY KEY,           -- User identifier
  username TEXT UNIQUE,          -- Login username  
  password_hash TEXT,            -- Base64 encoded password
  created_at TIMESTAMP
)
```
**Purpose**: Store user authentication credentials for custom auth system

#### 2. **profiles** table (User Settings & Data)
```sql
profiles (
  id UUID PRIMARY KEY REFERENCES users(id),  -- Links to user
  data JSONB DEFAULT '{}',                    -- All user settings/data
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```
**Purpose**: Store user settings, preferences, and non-relational data
**Data Structure**:
```json
{
  "settings": {
    "targetGoal": 20000,
    "reminderTime": "20:00", 
    "theme": "light",
    "quickActions": [1, 2, 3, 4]
  },
  "customWorkouts": {},
  "workoutState": {}
}
```

#### 3. **action_types** table (Action Definitions)
```sql
action_types (
  id SERIAL PRIMARY KEY,         -- Action type ID
  name TEXT,                     -- Action name ("Workout", "Junk Food")
  value INTEGER,                 -- Point value (+2000, -5000)
  category TEXT,                 -- "positive" or "negative"
  is_default BOOLEAN,            -- Whether it's a default action type
  user_id UUID REFERENCES users(id),  -- NULL for defaults, user ID for custom
  created_at TIMESTAMP
)
```
**Purpose**: Define available actions users can perform
**Types**:
- **Default Actions**: 16 built-in actions (8 positive, 8 negative), `user_id = NULL`
- **Custom Actions**: User-created actions, `user_id = user.id`

#### 4. **actions** table (User Activity Log)
```sql
actions (
  id SERIAL PRIMARY KEY,         
  user_id UUID REFERENCES users(id),      -- Which user performed action
  action_type_id INTEGER REFERENCES action_types(id),  -- What action
  date DATE,                               -- When (YYYY-MM-DD)
  notes TEXT,                              -- Optional notes
  value INTEGER,                           -- Cached point value
  created_at TIMESTAMP
)
```
**Purpose**: Log every action a user performs for tracking and statistics

## Current Problem Analysis

### The 406 Error Deep Dive

**What's Happening**:
```javascript
// This query is failing with 406:
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('data')
  .eq('id', this.user.id)
  .single();
```

**Possible Causes**:

1. **RLS Still Enabled**: Despite running setup scripts, RLS might still be active
2. **Missing Table**: Profiles table might not exist 
3. **Permission Issues**: API key might not have proper permissions
4. **Data Type Mismatch**: User ID format issues
5. **Supabase Configuration**: Project settings blocking access

### Authentication Flow Analysis

**Current Flow**:
1. User enters username/password
2. App queries `users` table directly ✅ (Working)
3. Stores user object in localStorage ✅ (Working)
4. On data load, queries `profiles` with user.id ❌ (Failing)

**Issue**: The custom auth system bypasses Supabase's built-in auth, but the database access might still expect Supabase auth tokens.

## Diagnostic Steps Needed

### Step 1: Verify Current Database State
Run this diagnostic query to understand what exists:

```sql
-- Check if tables exist and their structure
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'profiles', 'action_types', 'actions');

-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('users', 'profiles', 'action_types', 'actions');

-- Check if user exists in profiles table
SELECT id, data FROM profiles WHERE id = '992e292f-242a-4820-9694-3c1406b419bf';

-- Check permissions
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'profiles';
```

### Step 2: Test Direct Database Access
Test if the API can access the table at all:

```javascript
// Add this to browser console for testing:
const testProfileAccess = async () => {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log('Profiles test:', { data, error });
};
testProfileAccess();
```

## Potential Solutions

### Solution 1: Complete RLS Disable (Recommended)
```sql
-- Completely disable RLS and grant full access
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
GRANT ALL ON profiles TO authenticated, anon;
```

### Solution 2: Create Compatible RLS Policies
```sql
-- Create policies that work with custom auth
CREATE POLICY "Allow all access to profiles" ON profiles FOR ALL USING (true);
```

### Solution 3: Use Service Key Instead of Anon Key
- Switch to using the service role key for database operations
- This bypasses all RLS restrictions

### Solution 4: Create Profile Record
The user might not have a profile record yet:
```sql
INSERT INTO profiles (id, data) 
VALUES ('992e292f-242a-4820-9694-3c1406b419bf', '{}')
ON CONFLICT (id) DO NOTHING;
```

## Implementation Plan

### Phase 1: Immediate Fix (Database)
1. Run complete diagnostic
2. Disable RLS completely  
3. Create missing profile record
4. Test basic access

### Phase 2: Application Fix (Code)
1. Add better error handling
2. Create profile record automatically on first login
3. Add fallback for missing profiles

### Phase 3: Verification
1. Test full user flow
2. Verify all CRUD operations work
3. Test with multiple users

## Code Changes Needed

### 1. Auto-create Profile on Login
```javascript
// In signIn() method after successful auth:
await this.ensureUserProfile();

async ensureUserProfile() {
  if (!this.user) return;
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', this.user.id)
    .single();
    
  if (error && error.code === 'PGRST116') { // No rows found
    await supabase.from('profiles').insert({
      id: this.user.id,
      data: {
        settings: {
          targetGoal: 20000,
          reminderTime: '20:00',
          theme: 'light',
          quickActions: [1, 2, 3, 4]
        }
      }
    });
  }
}
```

### 2. Better Error Handling
```javascript
async loadData() {
  try {
    // ... existing code ...
  } catch (error) {
    if (error.code === 'PGRST301') {
      this.showNotification('Authentication expired. Please sign in again.', 'error');
      this.signOut();
    } else if (error.message.includes('406')) {
      this.showNotification('Database access restricted. Creating profile...', 'warning');
      await this.ensureUserProfile();
      // Retry loading data
      return this.loadData();
    }
    // ... rest of error handling ...
  }
}
```

## Next Steps

1. **Run Diagnostic**: Execute the diagnostic SQL to understand current state
2. **Fix Database**: Apply the appropriate database fixes
3. **Update Code**: Implement auto-profile creation
4. **Test**: Verify the complete user flow works

This systematic approach should resolve the 406 error and get your application fully functional. 