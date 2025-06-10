import { createClient } from '@supabase/supabase-js';

// Configuration Constants
const CONFIG = {
  // API & Database
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  SAVE_DEBOUNCE_DELAY: 2000, // 2 seconds
  
  // Validation Limits
  MAX_ACTION_TYPE_NAME_LENGTH: 50,
  MIN_ACTION_TYPE_NAME_LENGTH: 2,
  MAX_ACTION_VALUE: 10000,
  MAX_TARGET_GOAL: 100000000, // 10 crore
  MAX_NOTES_LENGTH: 500,
  MIN_PASSWORD_LENGTH: 6,
  
  // Date Constraints
  MAX_FUTURE_DAYS: 7,
  MAX_PAST_YEARS: 1,
  
  // UI & Animation
  NOTIFICATION_DURATION: 3000,
  NOTIFICATION_QUEUE_DELAY: 300,
  THEME_TRANSITION_DURATION: 300,
  RIPPLE_ANIMATION_DURATION: 600,
  
  // Performance
  MAX_STREAK_CALCULATION_DAYS: 1000,
  MAX_QUICK_ACTIONS: 6,
  BADGE_NOTIFICATION_DELAY: 1000,
  
  // Time Constants
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000,
  STATS_CALCULATION_WINDOW_DAYS: 30,
  MAX_CONSECUTIVE_DAYS_CHECK: 365,
  
  // Error Types
  CONNECTION_ERRORS: [
    'NetworkError',
    'Failed to fetch', 
    'Connection refused',
    'timeout',
    'PGRST301', // JWT expired
    'PGRST302'  // JWT malformed
  ],
  
  // Theme Configuration
  VALID_THEMES: ['light', 'dark', 'auto'],
  DEFAULT_THEME: 'light',
  
  // Z-index layers
  Z_NOTIFICATION: 10000
};

// Application Messages
const MESSAGES = {
  SUCCESS: {
    ACTION_ADDED: 'Action added successfully!',
    SETTINGS_SAVED: 'Settings saved successfully!',
    BADGE_EARNED: '🎉 Badge Earned: {name}! {icon}',
    DATA_IMPORTED: 'Data imported successfully!',
    QUICK_ACTIONS_SAVED: 'Quick actions saved!',
    ACTION_DELETED: 'Action deleted successfully!'
  },
  ERROR: {
    USER_NOT_LOGGED_IN: 'User not logged in.',
    INVALID_ACTION_TYPE: 'Please select a valid action type.',
    ACTION_TYPE_NOT_FOUND: 'Action type not found.',
    DATE_REQUIRED: 'Date is required',
    INVALID_DATE_FORMAT: 'Invalid date format',
    NETWORK_ERROR: 'Network connection error. Please check your internet.',
    DATABASE_ERROR: 'Database connection error. Please try again.',
    SAVE_FAILED: 'Failed to save data. Please try again.'
  },
  WARNING: {
    SESSION_EXPIRED: 'Session expired. Please sign in again.',
    CONNECTION_ISSUES: 'Database connection issues detected. Some features may be limited.',
    OFFLINE_MODE: 'Using offline data due to connection error.'
  }
};

console.log("HabitideApp: DEBUG - VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("HabitideApp: DEBUG - VITE_SUPABASE_ANON_KEY is present:", !!import.meta.env.VITE_SUPABASE_ANON_KEY);

// Initialize Supabase client with enhanced options
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: localStorage
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: { 
        'X-Client-Info': 'habitide-tracker@1.0.0',
        'Cache-Control': 'no-cache'
      }
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);

// Database connection utilities
class DatabaseManager {
  static async withRetry(operation, maxRetries = CONFIG.RETRY_ATTEMPTS, delay = CONFIG.RETRY_DELAY_BASE) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        console.warn(`Database operation attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          throw new Error(`Database operation failed after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }
  }

  static isConnectionError(error) {
    return CONFIG.CONNECTION_ERRORS.some(errorType => 
      error?.message?.includes(errorType) || 
      error?.code?.includes(errorType)
    );
  }

  static async healthCheck() {
    try {
      const { data, error } = await supabase
        .from('action_types')
        .select('id')
        .limit(1);
        
      if (error && !this.isConnectionError(error)) {
        console.warn('Database health check failed:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Database health check error:', error);
      return false;
    }
  }

  /**
   * Safe database query with automatic error handling and retry logic
   * @param {string} table - Table name
   * @param {string} operation - Operation type ('select', 'insert', 'update', 'delete')
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Result with data, error, and success status
   */
  static async safeQuery(table, operation, options = {}) {
    return await this.withRetry(async () => {
      let query = supabase.from(table);
      
      switch (operation) {
        case 'select':
          query = query.select(options.select || '*');
          if (options.eq) query = query.eq(options.eq.column, options.eq.value);
          if (options.filter) query = query.filter(options.filter.column, options.filter.operator, options.filter.value);
          if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending });
          if (options.limit) query = query.limit(options.limit);
          break;
          
        case 'insert':
          query = query.insert(options.data);
          if (options.select) query = query.select(options.select);
          break;
          
        case 'update':
          query = query.update(options.data);
          if (options.eq) query = query.eq(options.eq.column, options.eq.value);
          if (options.select) query = query.select(options.select);
          break;
          
        case 'delete':
          if (options.eq) query = query.eq(options.eq.column, options.eq.value);
          break;
          
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return {
        success: true,
        data: data || null,
        error: null
      };
    });
  }
}

console.log("HabitideApp: DEBUG - Supabase client object:", supabase); // DEBUG LOG

// Performance Utilities
const PerformanceUtils = {
  /**
   * Debounce function to limit function execution frequency
   */
  debounce(func, delay = CONFIG.SAVE_DEBOUNCE_DELAY) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },

  /**
   * Throttle function to ensure function runs at most once per interval
   */
  throttle(func, limit = CONFIG.SAVE_DEBOUNCE_DELAY) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Cache manager for expensive operations
   */
  cache: new Map(),

  /**
   * Memoization utility with TTL (Time To Live)
   */
  memoize(func, ttl = CONFIG.CACHE_DURATION) {
    const cache = this.cache;
    return function (...args) {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.value;
      }
      
      const result = func.apply(this, args);
      cache.set(key, {
        value: result,
        timestamp: Date.now()
      });
      
      return result;
    };
  },

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CONFIG.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  },

  /**
   * Performance timing wrapper
   */
  time(func, label = 'Operation') {
    return function (...args) {
      const start = performance.now();
      const result = func.apply(this, args);
      const end = performance.now();
      console.log(`${label} took ${(end - start).toFixed(2)}ms`);
      return result;
    };
  },

  /**
   * Performance timing for async operations
   */
  async timeAsync(func, label = 'Async Operation') {
    const start = performance.now();
    const result = await func();
    const end = performance.now();
    console.log(`${label} took ${(end - start).toFixed(2)}ms`);
    return result;
  }
};

// Utility functions
const formatCurrency = (amount) => `₹${Math.abs(amount).toLocaleString('en-IN')}`;

// Enhanced date utility with timezone handling and edge case protection
const getDateString = (date) => {
  try {
    if (!date) {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    if (typeof date === 'string') {
      // Handle various date string formats
      if (date.includes('T')) return date.split('T')[0];
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
      // Try to parse as date and convert using local time
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
    if (date instanceof Date) {
      if (isNaN(date.getTime())) {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    // Try to convert other types to date
    const converted = new Date(date);
    if (isNaN(converted.getTime())) {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    return `${converted.getFullYear()}-${String(converted.getMonth() + 1).padStart(2, '0')}-${String(converted.getDate()).padStart(2, '0')}`;
  } catch (error) {
    console.warn('Date conversion error:', error, 'for date:', date);
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
};

/**
 * Enhanced date validation with timezone and boundary checking
 */
const validateDate = (dateString) => {
  if (!dateString) {
    return { valid: false, error: MESSAGES.ERROR.DATE_REQUIRED };
  }

  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return { valid: false, error: MESSAGES.ERROR.INVALID_DATE_FORMAT };
    }

    const today = new Date();
    const minDate = new Date();
    minDate.setFullYear(today.getFullYear() - CONFIG.MAX_PAST_YEARS);
    
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + CONFIG.MAX_FUTURE_DAYS);

    // Check date boundaries
    if (date < minDate) {
      return { valid: false, error: `Date cannot be more than ${CONFIG.MAX_PAST_YEARS} year(s) in the past.` };
    }
    
    if (date > maxDate) {
      return { valid: false, error: `Date cannot be more than ${CONFIG.MAX_FUTURE_DAYS} days in the future.` };
    }

    return { valid: true, date };
  } catch (error) {
    return { valid: false, error: MESSAGES.ERROR.INVALID_DATE_FORMAT };
  }
};

/**
 * Enhanced date comparison with timezone safety
 */
const isSameDate = (date1, date2) => {
  try {
    const d1 = getDateString(date1);
    const d2 = getDateString(date2);
    return d1 === d2;
  } catch (error) {
    console.warn('Date comparison error:', error);
    return false;
  }
};

/**
 * Safe date arithmetic with boundary checking
 */
const addDays = (date, days) => {
  try {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  } catch (error) {
    console.warn('Date arithmetic error:', error);
    return new Date();
  }
};

/**
 * Input sanitization utility
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, CONFIG.MAX_NOTES_LENGTH); // Limit length
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Main app class
class HabitideApp {
  constructor() {
    // Initialize before anything else to prevent flickering
    this.initializeTheme();
    
    this.user = null;
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.eventListenersAttached = false;
    
    // Debounced save function to prevent excessive database calls
    this.debouncedSave = PerformanceUtils.debounce(() => this.saveDataToDatabase(), 500);
    
    // Initialize data structure
    this.data = {
      settings: { targetGoal: 20000, reminderTime: '20:00', theme: 'light', quickActions: [1, 2, 3, 4] },
      actions: [],
      workoutProgress: {},
      customWorkouts: {},
      workoutState: {},
      actionTypes: { positive: [], negative: [] },
      badges: [
        // Milestone badges
        { id: 1, name: "First Step", icon: "🎯", type: "milestone", requirement: 1, description: "Complete your first action", earned: false },
        
        // Streak badges
        { id: 2, name: "Week Warrior", icon: "🔥", type: "streak", requirement: 7, description: "7-day streak", earned: false },
        { id: 3, name: "Month Master", icon: "💎", type: "streak", requirement: 30, description: "30-day streak", earned: false },
        { id: 4, name: "Hundred Hero", icon: "👑", type: "streak", requirement: 100, description: "100-day streak", earned: false },
        
        // Savings badges (debt reduction)
        { id: 5, name: "Quarter Crusher", icon: "⭐", type: "savings", requirement: 0.25, description: "Reduce debt by 25%", earned: false },
        { id: 6, name: "Half Hero", icon: "🌟", type: "savings", requirement: 0.5, description: "Reduce debt by 50%", earned: false },
        { id: 7, name: "Debt Destroyer", icon: "💰", type: "savings", requirement: 1.0, description: "Eliminate all debt", earned: false },
        
        // Action count badges
        { id: 8, name: "Action Hero", icon: "💪", type: "actions", requirement: 50, description: "Complete 50 positive actions", earned: false },
        { id: 9, name: "Century Club", icon: "🏆", type: "actions", requirement: 100, description: "Complete 100 positive actions", earned: false },
        { id: 10, name: "Thousand Strong", icon: "🎖️", type: "actions", requirement: 1000, description: "Complete 1000 positive actions", earned: false }
      ],
      lastFetched: null // Add lastFetched timestamp
    };

    // 7-day workout routines with supersets and time tracking
    this.workoutRoutines = {
      Monday: {
        focus: "Strength Training - Full Body",
        totalTime: "45-50 min",
        phases: [
          {
            type: "warmup",
            name: "Warm-up",
            duration: "5 min",
            exercises: [
              { name: "Light Cardio", duration: "5 min", description: "Treadmill, bike, or light jogging" }
            ]
          },
          {
            type: "superset",
            name: "Superset 1",
            restTime: "1-2 min",
            exercises: [
              { name: "Squats", sets: 3, reps: "8-12", notes: "Focus on form and depth" },
              { name: "Bench Press", sets: 3, reps: "8-12", notes: "Control the negative" }
            ]
          },
          {
            type: "single",
            name: "Deadlifts",
            restTime: "1-2 min",
            exercises: [
              { name: "Deadlifts", sets: 3, reps: "8-12", notes: "Keep back straight, drive through heels" }
            ]
          },
          {
            type: "superset",
            name: "Superset 2",
            restTime: "1-2 min",
            exercises: [
              { name: "Overhead Press", sets: 3, reps: "8-12", notes: "Full range of motion" },
              { name: "Bent-over Rows", sets: 3, reps: "8-12", notes: "Squeeze shoulder blades" }
            ]
          },
          {
            type: "single",
            name: "Core Work",
            restTime: "1 min",
            exercises: [
              { name: "Planks", sets: 3, reps: "30-60s", notes: "Keep body straight" }
            ]
          },
          {
            type: "cooldown",
            name: "Cool-down",
            duration: "5 min",
            exercises: [
              { name: "Stretching", duration: "5 min", description: "Focus on worked muscle groups" }
            ]
          }
        ]
      },
      Tuesday: {
        focus: "Cardio - HIIT",
        totalTime: "25-30 min",
        phases: [
          {
            type: "warmup",
            name: "Warm-up",
            duration: "5 min",
            exercises: [
              { name: "Light Jogging", duration: "5 min", description: "Prepare for high intensity" }
            ]
          },
          {
            type: "hiit",
            name: "HIIT Circuit",
            duration: "15-20 min",
            exercises: [
              { name: "Sprint Intervals", duration: "15-20 min", description: "15 rounds of 30s sprint + 30s rest. Push hard during sprints!" }
            ]
          },
          {
            type: "cooldown",
            name: "Cool-down",
            duration: "5 min",
            exercises: [
              { name: "Walking & Stretching", duration: "5 min", description: "Gradual heart rate recovery" }
            ]
          }
        ]
      },
      Wednesday: {
        focus: "Strength Training - Full Body",
        totalTime: "45-50 min",
        phases: [
          {
            type: "warmup",
            name: "Warm-up",
            duration: "5 min",
            exercises: [
              { name: "Light Cardio", duration: "5 min", description: "Dynamic movements preferred" }
            ]
          },
          {
            type: "superset",
            name: "Superset 1",
            restTime: "1-2 min",
            exercises: [
              { name: "Lunges", sets: 3, reps: "10/leg", notes: "Alternate legs or single leg focus" },
              { name: "Push-ups", sets: 3, reps: "to failure", notes: "Modify as needed" }
            ]
          },
          {
            type: "superset",
            name: "Superset 2",
            restTime: "1-2 min",
            exercises: [
              { name: "Pull-ups/Lat Pulldowns", sets: 3, reps: "8-12", notes: "Use assistance if needed" },
              { name: "Dumbbell Shoulder Press", sets: 3, reps: "8-12", notes: "Control the movement" }
            ]
          },
          {
            type: "superset",
            name: "Superset 3",
            restTime: "1-2 min",
            exercises: [
              { name: "Hip Thrusts", sets: 3, reps: "10-15", notes: "Squeeze glutes at top" },
              { name: "Russian Twists", sets: 3, reps: "15-20", notes: "Control the rotation" }
            ]
          },
          {
            type: "cooldown",
            name: "Cool-down",
            duration: "5 min",
            exercises: [
              { name: "Stretching", duration: "5 min", description: "Focus on flexibility" }
            ]
          }
        ]
      },
      Thursday: {
        focus: "Cardio - Steady State",
        totalTime: "30-45 min",
        phases: [
          {
            type: "cardio",
            name: "Steady State Cardio",
            duration: "30-45 min",
            exercises: [
              { name: "Moderate Cardio", duration: "30-45 min", description: "Jogging, cycling, or elliptical at moderate intensity" }
            ]
          }
        ]
      },
      Friday: {
        focus: "Strength Training - Full Body",
        totalTime: "45-50 min",
        phases: [
          {
            type: "warmup",
            name: "Warm-up",
            duration: "5 min",
            exercises: [
              { name: "Light Cardio", duration: "5 min", description: "Prepare for strength work" }
            ]
          },
          {
            type: "superset",
            name: "Superset 1",
            restTime: "1-2 min",
            exercises: [
              { name: "Leg Press", sets: 3, reps: "10-15", notes: "Full range of motion" },
              { name: "Incline Bench Press", sets: 3, reps: "8-12", notes: "Focus on upper chest" }
            ]
          },
          {
            type: "superset",
            name: "Superset 2",
            restTime: "1-2 min",
            exercises: [
              { name: "Seated Rows", sets: 3, reps: "8-12", notes: "Pull to lower chest" },
              { name: "Lateral Raises", sets: 3, reps: "12-15", notes: "Control the weight" }
            ]
          },
          {
            type: "superset",
            name: "Superset 3",
            restTime: "1 min",
            exercises: [
              { name: "Leg Raises", sets: 3, reps: "15-20", notes: "Control the movement" },
              { name: "Planks", sets: 3, reps: "30-60s", notes: "Maintain form" }
            ]
          },
          {
            type: "cooldown",
            name: "Cool-down",
            duration: "5 min",
            exercises: [
              { name: "Stretching", duration: "5 min", description: "Focus on recovery" }
            ]
          }
        ]
      },
      Saturday: {
        focus: "Football and Running",
        totalTime: "Variable",
        phases: [
          {
            type: "activity",
            name: "Football Game",
            duration: "60-90 min",
            exercises: [
              { name: "Football Game", duration: "60-90 min", description: "Enjoy the game and compete!" }
            ]
          },
          {
            type: "activity",
            name: "Step Goal",
            target: "10,000 steps",
            exercises: [
              { name: "Walking/Running", target: "~10,000 steps", description: "Track throughout the day" }
            ]
          }
        ]
      },
      Sunday: {
        focus: "Rest & Recovery",
        totalTime: "Optional",
        phases: [
          {
            type: "recovery",
            name: "Light Activity",
            duration: "20-30 min",
            exercises: [
              { name: "Walking", duration: "20-30 min", description: "Light pace, enjoy nature" },
              { name: "Yoga/Stretching", duration: "10-20 min", description: "Focus on flexibility and relaxation" }
            ]
          }
        ]
      }
    };
    
    this.invalidateStatsCache();
    
    this.currentSection = 'dashboard';
    this.restTimer = null; // To hold the rest timer interval ID
    this.authStateChangeListenerAttached = false;
  }

  // Add new method to initialize theme immediately
  initializeTheme() {
    // Get theme from localStorage first (for immediate application)
    const savedTheme = localStorage.getItem('habitide-theme') || 'light';
    
    // Apply theme immediately to prevent flickering
    document.documentElement.setAttribute('data-color-scheme', savedTheme);
    
    // Override system preference immediately by setting a more specific selector
    const style = document.createElement('style');
    style.textContent = `
      [data-color-scheme="${savedTheme}"] {
        color-scheme: ${savedTheme};
      }
    `;
    document.head.appendChild(style);
  }

  async init() {
    try {
      this.showLoadingOverlay();
      // Check authentication
      await this.checkAuth();
      if (this.user) {
        // User is authenticated - load data and initialize app
        await this.loadData();
        await this.loadActionTypes();
        // Apply theme immediately after loading settings but prioritize localStorage
        const savedTheme = localStorage.getItem('habitide-theme') || this.data.settings.theme;
        this.setTheme(savedTheme);
        // Initialize date
        this.setTodayDate();
        // Ensure main sections exist before rendering
        this.ensureMainSectionsExist();
        // Reset render flags for fresh start
        this.resetRenderFlags();
        // Initial render (only after data and sections are ready)
        await this.renderAll();
        // Setup event listeners
        this.reAttachEventListeners();
        // Setup notifications
        await this.requestNotificationPermission();
        // Setup daily reminder
        this.setupDailyReminder();
        // Default action types are now handled by database setup
        // await this.ensureUserHasDefaultActionTypes(); // DISABLED - using new 16 actions from DB
        // Removed welcome notification
      } else {
        // User not authenticated - show auth UI
        // Apply default light theme even when not logged in
        this.setTheme('light');
        this.showAuthUI();
      }
    } catch (error) {
      console.error('Initialization error:', error);
      this.showNotification(MESSAGES.ERROR.DATABASE_ERROR, 'error');
      // Fallback to auth UI on any error
      this.showAuthUI();
    } finally {
      this.hideLoadingOverlay();
    }
  }

  showLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  }

  async checkAuth() {
    console.log("HabitideApp: DEBUG - checkAuth() called");
    
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error("HabitideApp: DEBUG - supabase.auth.getUser() error:", error);
      this.user = null;
      return; // Let init() handle showing auth UI
    }

    console.log("HabitideApp: DEBUG - supabase.auth.getUser() response - user:", user ? 'Object' : 'null', "error:", error);
    
    if (user) {
      this.user = user;
    } else {
      this.user = null;
    }
    
    console.log("HabitideApp: DEBUG - checkAuth() completed. this.user set to:", this.user ? 'Object' : 'null');
    
    // Set up the session listener only once
    if (!this.authStateChangeListenerAttached) {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log("HabitideApp: DEBUG - onAuthStateChange event:", event, "session:", session);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                this.user = session.user;
                // Reload the app when user signs in
                this.init();
            } else if (event === 'SIGNED_OUT') {
                this.user = null;
                this.showAuthUI();
            }
        });
        this.authStateChangeListenerAttached = true;
    }
  }

  // Handles visibility change to trigger auth token refresh
  handleVisibilityChange = () => {
    if (document.hidden) {
      this.checkAuth();
    }
  };

  toggleTheme() {
    const current = this.data.settings.theme;
    const next = current === 'light' ? 'dark' : 'light';
    this.setTheme(next);
    this.saveData(); // Save theme change to database
    // REMOVED: No notification for theme changes
  }

  setTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateInput = document.getElementById('actionDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = `${year}-${month}-${day}`;
      // Set max date to today + 7 days (prevent far future dates)
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 7);
      const maxYear = maxDate.getFullYear();
      const maxMonth = String(maxDate.getMonth() + 1).padStart(2, '0');
      const maxDay = String(maxDate.getDate()).padStart(2, '0');
      dateInput.max = `${maxYear}-${maxMonth}-${maxDay}`;
      
      // Set min date to 1 year ago (prevent too old dates)
      const minDate = new Date(today);
      minDate.setFullYear(minDate.getFullYear() - 1);
      const minYear = minDate.getFullYear();
      const minMonth = String(minDate.getMonth() + 1).padStart(2, '0');
      const minDay = String(minDate.getDate()).padStart(2, '0');
      dateInput.min = `${minYear}-${minMonth}-${minDay}`;
    }
  }

  validateDate(dateString) {
    if (!dateString) {
      return { valid: false, error: MESSAGES.ERROR.DATE_REQUIRED };
    }

    const date = new Date(dateString);
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - CONFIG.MAX_PAST_YEARS);
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + CONFIG.MAX_FUTURE_DAYS);

    if (isNaN(date.getTime())) {
      return { valid: false, error: MESSAGES.ERROR.INVALID_DATE_FORMAT };
    }

    if (date < oneYearAgo) {
      return { valid: false, error: `Date cannot be more than ${CONFIG.MAX_PAST_YEARS} year ago` };
    }

    if (date > oneWeekFromNow) {
      return { valid: false, error: `Date cannot be more than ${CONFIG.MAX_FUTURE_DAYS} days in the future` };
    }

    return { valid: true };
  }

  /**
   * Centralized validation for action input
   * @param {number} typeId - Action type ID
   * @param {string} customName - Custom action name
   * @param {string} dateString - Date string 
   * @returns {Object} Validation result with actionType, dateToUse, notes
   */
  validateActionInput(typeId, customName = '', dateString = null) {
    // Validate type ID
    if (!typeId || isNaN(typeId)) {
      return { valid: false, error: MESSAGES.ERROR.INVALID_ACTION_TYPE };
    }

    const actionType = this.findActionType(typeId);
    if (!actionType && !customName) {
      return { valid: false, error: MESSAGES.ERROR.ACTION_TYPE_NOT_FOUND };
    }

    const dateToUse = dateString || getDateString(new Date());
    
    // Enhanced date validation using global validateDate function
    const dateValidation = validateDate(dateToUse);
    if (!dateValidation.valid) {
      return { valid: false, error: dateValidation.error };
    }

    const notesElement = document.getElementById('actionNotes');
    const notes = notesElement ? notesElement.value.trim() : '';

    // Validate notes length
    if (notes.length > CONFIG.MAX_NOTES_LENGTH) {
      return { valid: false, error: `Notes cannot exceed ${CONFIG.MAX_NOTES_LENGTH} characters.` };
    }

    return { 
      valid: true, 
      actionType, 
      dateToUse, 
      notes 
    };
  }

  showNotification(message, type = 'info', duration = CONFIG.NOTIFICATION_DURATION) {
    // Initialize notification queue if not exists
    if (!this.notificationQueue) {
      this.notificationQueue = [];
    }

    // Create notification object
    const notificationData = {
      id: Date.now() + Math.random(),
      message,
      type,
      duration
    };

    // Add to queue
    this.notificationQueue.push(notificationData);

    // Process queue if not already processing
    if (!this.processingNotifications) {
      this.processNotificationQueue();
    }
  }

  async processNotificationQueue() {
    this.processingNotifications = true;

    while (this.notificationQueue.length > 0) {
      const notificationData = this.notificationQueue.shift();
      await this.displayNotification(notificationData);
      
      // Small delay between notifications
      if (this.notificationQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.NOTIFICATION_QUEUE_DELAY));
      }
    }

    this.processingNotifications = false;
  }

  displayNotification(notificationData) {
    return new Promise((resolve) => {
      const notification = document.createElement('div');
      notification.className = `notification notification--${notificationData.type}`;
      // Mobile-responsive notification positioning
      const isMobile = window.innerWidth <= 768;
      
      notification.style.cssText = `
        position: fixed;
        ${isMobile ? 'top: 70px; left: 16px; right: 16px;' : 'top: 100px; right: 20px; min-width: 320px; max-width: 500px;'}
        padding: 16px 20px;
        border-radius: var(--radius-lg);
        font-weight: var(--font-weight-medium);
        font-size: var(--font-size-base);
        box-shadow: var(--shadow-lg);
        z-index: ${CONFIG.Z_NOTIFICATION || 10000};
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transform: ${isMobile ? 'translateY(-100%)' : 'translateX(100%)'};
        transition: transform 0.3s ease;
      `;

      // Set type-specific styles
      const typeStyles = {
        success: { background: 'rgba(34, 197, 94, 0.9)', color: 'white' },
        error: { background: 'rgba(239, 68, 68, 0.9)', color: 'white' },
        warning: { background: 'rgba(245, 158, 11, 0.9)', color: 'white' },
        info: { background: 'rgba(59, 130, 246, 0.9)', color: 'white' }
      };

      const style = typeStyles[notificationData.type] || typeStyles.info;
      notification.style.background = style.background;
      notification.style.color = style.color;

      // Add icon and message
      const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      };

      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 18px;">${icons[notificationData.type] || icons.info}</span>
          <span>${notificationData.message}</span>
        </div>
      `;

      document.body.appendChild(notification);

      // Animate in with mobile-appropriate direction
      requestAnimationFrame(() => {
        notification.style.transform = isMobile ? 'translateY(0)' : 'translateX(0)';
      });

      // Auto-remove after duration
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
          resolve();
        }, 300);
      }, notificationData.duration);
    });
  }

  async navigateToSection(sectionName) {
    // Remove active class from all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Remove active class from all nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    
    // Add active class to target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
      targetSection.classList.add('active');
    }
    
    // Add active class to corresponding nav link
    const activeNavLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
    if (activeNavLink) {
      activeNavLink.classList.add('active');
    }
    
    // Re-render section-specific content if needed
    if (sectionName === 'calendar') {
      this.renderCalendar();
    } else if (sectionName === 'workout') {
      this.renderWorkout();
    } else if (sectionName === 'profile') {
      this.renderProfile();
    } else if (sectionName === 'dashboard') {
      // Data freshness check: 1 minute (60000 ms) threshold
      const now = Date.now();
      const isStale = !this.data.lastFetched || (now - this.data.lastFetched > 60000);
      if (isStale) {
        await this.loadData();
        await this.loadActionTypes();
      }
      this.updateDashboardStats();
      this.renderQuickActions();
      this.renderRecentActivities();
    }
    
    // Mark sections as needing re-render when navigating
    if (targetSection) targetSection.dataset.rendered = 'false';
  }

  renderAll() {
    // Only render sections that haven't been rendered yet or need updates
    const dashboardSection = document.getElementById('dashboard');
    const workoutSection = document.getElementById('workout');
    const calendarSection = document.getElementById('calendar');
    const profileSection = document.getElementById('profile');
    
    if (dashboardSection && !dashboardSection.dataset.rendered) {
      this.renderDashboard();
      dashboardSection.dataset.rendered = 'true';
    }
    if (workoutSection && !workoutSection.dataset.rendered) {
      this.renderWorkout();
      workoutSection.dataset.rendered = 'true';
    }
    if (calendarSection && !calendarSection.dataset.rendered) {
      this.renderCalendar();
      calendarSection.dataset.rendered = 'true';
    }
    if (profileSection && !profileSection.dataset.rendered) {
      this.renderProfile();
      profileSection.dataset.rendered = 'true';
    }
    
    // Attach event listeners
    this.reAttachEventListeners();
  }

  reAttachEventListeners() {
    // Allow re-attachment for new DOM elements
    console.log('Attaching event listeners...');
    
    // Navigation links
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    navLinks.forEach(link => {
      if (!link.dataset.listenerAttached) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetSection = link.getAttribute('data-section');
          this.navigateToSection(targetSection);
        });
        link.dataset.listenerAttached = 'true';
      }
    });

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle && !themeToggle.dataset.listenerAttached) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
      themeToggle.dataset.listenerAttached = 'true';
    }

    // Add action button - always attach for new DOM elements
    const addActionBtn = document.getElementById('addActionBtn');
    if (addActionBtn) {
      addActionBtn.addEventListener('click', () => {
        const typeIdElement = document.getElementById('addActionType');
        const notesElement = document.getElementById('actionNotes');
        const dateElement = document.getElementById('actionDate');
        
        const typeId = typeIdElement?.value;
        const notes = notesElement?.value?.trim() || '';
        const date = dateElement?.value;
        
        if (!date) {
          this.showNotification('Please select a date', 'error');
          dateElement?.focus();
          return;
        }
        
        if (!typeId) {
          this.showNotification('Please select an action type', 'error');
          typeIdElement?.focus();
          return;
        }
        
        this.addAction(parseInt(typeId), 0, notes, date, false); // Manual form action
      });
      console.log('Add Action button listener attached');
    }

    // Clear form button
    const clearFormBtn = document.getElementById('clearFormBtn');
    if (clearFormBtn) {
      clearFormBtn.addEventListener('click', () => {
        const typeElement = document.getElementById('addActionType');
        const notesElement = document.getElementById('actionNotes');
        const hintElement = document.getElementById('actionTypeHint');
        
        if (typeElement) typeElement.value = '';
        if (notesElement) notesElement.value = '';
        if (hintElement) hintElement.textContent = '';
        
        this.setTodayDate();
      });
    }

    // Action type selection hint
    const actionTypeSelect = document.getElementById('addActionType');
    if (actionTypeSelect) {
      actionTypeSelect.addEventListener('change', (e) => {
        const typeId = parseInt(e.target.value);
        const hintElement = document.getElementById('actionTypeHint');
        
        if (typeId && hintElement) {
          const actionType = this.findActionType(typeId);
          if (actionType) {
            const valueText = actionType.value > 0 ? 
              `+${formatCurrency(actionType.value)}` : 
              `${formatCurrency(actionType.value)}`;
            hintElement.textContent = `Value: ${valueText}`;
            hintElement.style.color = actionType.value > 0 ? 'var(--color-success)' : 'var(--color-error)';
          }
        } else if (hintElement) {
          hintElement.textContent = '';
        }
      });
    }
  }

  renderDashboard() {
    const section = document.getElementById('dashboard');
    if (!section) return;
    
    section.innerHTML = `
      <div class="container">
        <div class="dashboard-header">
          <div class="dashboard-title">
            <h1>Dashboard</h1>
          </div>
        </div>

        <!-- Progress Overview -->
        <div class="card progress-overview">
          <div class="card__body">
            <h3>Progress Overview</h3>
            <div class="progress-stats">
              <div class="stat-card target-goal">
                <span class="stat-label">Starting Debt</span>
                <span class="stat-value" id="targetGoalDisplay"></span>
              </div>
              <div class="stat-card current-level">
                <span class="stat-label">Current Debt</span>
                <span class="stat-value" id="currentLevelDisplay"></span>
              </div>
              <div class="stat-card points-earned">
                <span class="stat-label">Points Earned</span>
                <span class="stat-value positive" id="totalEarned"></span>
              </div>
              <div class="stat-card points-lost">
                <span class="stat-label">Points Lost</span>
                <span class="stat-value negative" id="totalLost"></span>
              </div>
            </div>
            <div class="goal-progress">
              <div class="progress-header">
                <span class="progress-title">Goal Progress</span>
                <span class="progress-percentage" id="progressPercentage"></span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
              </div>
              <div class="progress-description">
                <span id="progressDescription"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Actions -->
        <div class="card add-actions-card">
          <div class="card__body">
            <h3>Add Actions</h3>
            <p class="add-actions-subtitle">Add actions for any date</p>
            <div class="add-actions-form">
              <div class="form-group">
                <label class="form-label" for="actionDate">Select Date</label>
                <input type="date" class="form-control" id="actionDate">
              </div>
              <div class="form-group">
                <label class="form-label" for="addActionType">Action Type</label>
                <select class="form-control" id="addActionType">
                  <option value="">Choose an action...</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="actionNotes">Notes (Optional)</label>
                <input type="text" class="form-control" id="actionNotes" placeholder="Add a note...">
              </div>
              <div class="form-actions">
                <button class="btn btn--primary" id="addActionBtn">Add Action</button>
                <button class="btn btn--secondary" id="clearFormBtn">Clear</button>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-bottom">
          <!-- Quick Actions - Today -->
          <div class="card quick-actions-card">
            <div class="card__body">
              <h3>Quick Actions - Today</h3>
              <p class="quick-actions-subtitle">One action per type per day</p>
              <div class="quick-actions-grid" id="quickActionsContainer">
                <!-- Quick actions will be populated here -->
              </div>
            </div>
          </div>

          <!-- Recent Activities -->
          <div class="card activities-card">
            <div class="card__body">
              <h3>Recent Activities</h3>
              <div class="activities-list" id="recentActivities">
                <!-- Recent activities will be populated here -->
              </div>
            </div>
          </div>
        </div>

        <!-- Achievement Badges -->
        <div class="achievement-badges-section">
          <h2 class="badges-title">Achievement Badges</h2>
          <p class="badges-subtitle">Unlock badges by completing goals and building habits</p>
                     <div class="badges-grid" id="badgesContainer">
             <!-- Badges will be populated here -->
           </div>
        </div>
      </div>
    `;

    // Set today's date in the date input
    this.setTodayDate();
    
    // Populate dynamic content
    this.updateDashboardStats();
    this.populateActionTypeSelects();
    this.renderQuickActions();
    this.renderRecentActivities();
    this.renderBadges();
    
    // Attach event listeners after content is ready
    this.reAttachEventListeners();
  }

  renderWorkout() {
    const section = document.getElementById('workout');
    if (!section) return;
    section.innerHTML = `
      <div class="container">
        <div class="section-header">
          <h1>Workout Tracker</h1>
        </div>
        <div class="workout-tabs">
          <button class="workout-tab" data-day="Monday">Monday</button>
          <button class="workout-tab" data-day="Tuesday">Tuesday</button>
          <button class="workout-tab" data-day="Wednesday">Wednesday</button>
          <button class="workout-tab" data-day="Thursday">Thursday</button>
          <button class="workout-tab" data-day="Friday">Friday</button>
          <button class="workout-tab" data-day="Saturday">Saturday</button>
          <button class="workout-tab" data-day="Sunday">Sunday</button>
        </div>
        <div class="workout-content" id="workoutContent"></div>
      </div>
    `;
    
    // Render today's workout initially and set the correct tab as active
    const today = new Date().toLocaleString('en-us', { weekday: 'long' });
    
    // Update active tab to today
    document.querySelectorAll('.workout-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.day === today) {
        tab.classList.add('active');
      }
    });
    
    this.renderWorkoutDay(today);
    
    // Re-attach workout tab event listeners
    document.querySelectorAll('.workout-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Update active tab
        document.querySelectorAll('.workout-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const day = e.currentTarget.dataset.day;
        this.renderWorkoutDay(day);
      });
    });
  }

  renderWorkoutDay(day) {
    const workoutContent = document.getElementById('workoutContent');
    if (!workoutContent) return;

    // Get workout routine (custom or default)
    const customWorkout = this.data.customWorkouts && this.data.customWorkouts[day];
    const routine = customWorkout || this.workoutRoutines[day];
    
    if (!routine) {
      // No routine available
      workoutContent.innerHTML = `
        <div class="card">
          <div class="card__body">
            <div class="empty-state-with-action">
              <div class="empty-state-icon">💪</div>
              <h4>No routine for ${day}</h4>
              <p class="empty-state">Create a custom workout routine for this day</p>
              <button class="btn btn--primary" onclick="app.showCustomWorkoutModal('${day}')">
                Create Custom Workout
              </button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Initialize workout state for this day if not exists
    if (!this.data.workoutState) this.data.workoutState = {};
    if (!this.data.workoutState[day]) this.data.workoutState[day] = {};

    // Calculate progress for new phase structure
    let totalItems = 0;
    let completedItems = 0;
    
    routine.phases?.forEach((phase, phaseIndex) => {
      if (phase.type === 'warmup' || phase.type === 'cooldown' || phase.type === 'cardio' || phase.type === 'activity' || phase.type === 'recovery') {
        totalItems += 1;
        const phaseState = this.data.workoutState[day][`phase_${phaseIndex}`];
        if (phaseState?.completed) completedItems += 1;
      } else {
        phase.exercises?.forEach((exercise, exerciseIndex) => {
          const totalSets = exercise.sets || 1;
          totalItems += totalSets;
          
          const exerciseState = this.data.workoutState[day][`phase_${phaseIndex}_ex_${exerciseIndex}`] || {};
          completedItems += Object.values(exerciseState).filter(completed => completed).length;
        });
      }
    });

    const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    workoutContent.innerHTML = `
      <div class="card">
        <div class="card__body">
          <div class="workout-header">
            <div class="workout-info">
              <h3>${day} - ${routine.focus}</h3>
              <div class="workout-time-info">
                <span class="workout-duration">⏱️ ${routine.totalTime}</span>
              </div>
              <div class="workout-progress-container">
                <div class="workout-progress-bar">
                  <div class="workout-progress-fill" style="width: ${progressPercentage}%"></div>
                </div>
                <span class="workout-progress-text">${completedItems}/${totalItems} items completed (${Math.round(progressPercentage)}%)</span>
              </div>
            </div>
            <div class="workout-actions">
              <button class="btn btn--outline" onclick="app.showCustomWorkoutModal('${day}')">
                ${customWorkout ? 'Edit Workout' : 'Customize'}
              </button>
              ${completedItems > 0 ? `
                <button class="btn btn--secondary" onclick="app.resetWorkoutDay('${day}')">
                  Reset Progress
                </button>
              ` : ''}
            </div>
          </div>
          
          <div class="workout-phases">
            ${routine.phases?.map((phase, phaseIndex) => {
              return this.renderWorkoutPhase(day, phase, phaseIndex);
            }).join('') || ''}
          </div>
          
          ${progressPercentage === 100 ? `
            <div class="workout-completion">
              <h4>🎉 Workout Complete!</h4>
              <p>Amazing work finishing your ${day} ${routine.focus}!</p>
              <p class="completion-time">💪 Total time: ${routine.totalTime}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderWorkoutPhase(day, phase, phaseIndex) {
    const phaseKey = `phase_${phaseIndex}`;
    const phaseState = this.data.workoutState[day][phaseKey] || {};
    
    // Handle different phase types
    if (phase.type === 'warmup' || phase.type === 'cooldown' || phase.type === 'cardio' || phase.type === 'activity' || phase.type === 'recovery' || phase.type === 'hiit') {
      const isCompleted = phaseState.completed || false;
      
      return `
        <div class="phase-card ${phase.type} ${isCompleted ? 'completed' : ''}">
          <div class="phase-header">
            <div class="phase-info">
              <h4 class="phase-name">
                ${this.getPhaseIcon(phase.type)} ${phase.name}
              </h4>
              <span class="phase-duration">${phase.duration || phase.target}</span>
              ${phase.restTime ? `<span class="phase-rest">Rest: ${phase.restTime}</span>` : ''}
            </div>
            <div class="phase-status">
              <label class="phase-complete-label ${isCompleted ? 'completed' : ''}">
                <input type="checkbox" class="phase-complete-checkbox" 
                       ${isCompleted ? 'checked' : ''}
                       onchange="app.togglePhase('${day}', ${phaseIndex}, this.checked)">
                ${isCompleted ? '✅ Complete' : 'Mark Complete'}
              </label>
            </div>
          </div>
          <div class="phase-exercises">
            ${phase.exercises.map(exercise => `
              <div class="phase-exercise-item">
                <strong>${exercise.name}</strong>
                ${exercise.duration ? `<span class="exercise-duration"> - ${exercise.duration}</span>` : ''}
                ${exercise.target ? `<span class="exercise-target"> - ${exercise.target}</span>` : ''}
                <p class="exercise-description">${exercise.description}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Handle superset and single exercise phases
    const totalSets = phase.exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0);
    let completedSets = 0;
    
    phase.exercises.forEach((exercise, exerciseIndex) => {
      const exerciseState = this.data.workoutState[day][`${phaseKey}_ex_${exerciseIndex}`] || {};
      completedSets += Object.values(exerciseState).filter(completed => completed).length;
    });
    
    const phaseProgress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
    const isPhaseComplete = phaseProgress === 100;
    
    return `
      <div class="phase-card ${phase.type} ${isPhaseComplete ? 'completed' : ''}">
        <div class="phase-header">
          <div class="phase-info">
            <h4 class="phase-name">
              ${this.getPhaseIcon(phase.type)} ${phase.name}
            </h4>
            ${phase.restTime ? `<span class="phase-rest">Rest between sets: ${phase.restTime}</span>` : ''}
            <div class="phase-progress">
              <span class="phase-progress-text">${completedSets}/${totalSets} sets completed</span>
              <div class="phase-progress-bar">
                <div class="phase-progress-fill" style="width: ${phaseProgress}%"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="phase-exercises">
          ${phase.exercises.map((exercise, exerciseIndex) => {
            const exerciseState = this.data.workoutState[day][`${phaseKey}_ex_${exerciseIndex}`] || {};
            const exerciseCompletedSets = Object.values(exerciseState).filter(completed => completed).length;
            const isExerciseComplete = exerciseCompletedSets === exercise.sets;
            
            return `
              <div class="exercise-card ${isExerciseComplete ? 'completed' : ''}">
                <div class="exercise-header">
                  <div class="exercise-info">
                    <h5 class="exercise-name">${exercise.name}</h5>
                    <span class="exercise-sets-reps">${exercise.sets} sets × ${exercise.reps}</span>
                    ${exercise.notes ? `<p class="exercise-notes">${exercise.notes}</p>` : ''}
                  </div>
                  <div class="exercise-status">
                    ${isExerciseComplete ? '✅' : `${exerciseCompletedSets}/${exercise.sets}`}
                  </div>
                </div>
                <div class="sets-tracker">
                  ${Array.from({length: exercise.sets}, (_, setIndex) => {
                    const isSetCompleted = exerciseState[setIndex] || false;
                    return `
                      <label class="set-label ${isSetCompleted ? 'completed' : ''}">
                        <input type="checkbox" class="set-checkbox" 
                               ${isSetCompleted ? 'checked' : ''}
                               onchange="app.toggleSet('${day}', '${phaseKey}_ex_${exerciseIndex}', ${setIndex}, this.checked)">
                        Set ${setIndex + 1}
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  getPhaseIcon(type) {
    const icons = {
      warmup: '🔥',
      superset: '💪',
      single: '🎯',
      hiit: '⚡',
      cardio: '🏃',
      cooldown: '🧘',
      activity: '⚽',
      recovery: '🌱'
    };
    return icons[type] || '💪';
  }

  toggleSet(day, exerciseKey, setIndex, completed) {
    // Initialize nested objects if they don't exist
    if (!this.data.workoutState) this.data.workoutState = {};
    if (!this.data.workoutState[day]) this.data.workoutState[day] = {};
    if (!this.data.workoutState[day][exerciseKey]) this.data.workoutState[day][exerciseKey] = {};
    
    // Update set completion state
    this.data.workoutState[day][exerciseKey][setIndex] = completed;
    
    // Save to database
    this.saveData();
    
    // Re-render the workout day to update progress
    this.renderWorkoutDay(day);
  }

  togglePhase(day, phaseIndex, completed) {
    // Initialize nested objects if they don't exist
    if (!this.data.workoutState) this.data.workoutState = {};
    if (!this.data.workoutState[day]) this.data.workoutState[day] = {};
    
    const phaseKey = `phase_${phaseIndex}`;
    if (!this.data.workoutState[day][phaseKey]) this.data.workoutState[day][phaseKey] = {};
    
    // Update phase completion state
    this.data.workoutState[day][phaseKey].completed = completed;
    
    // Save to database
    this.saveData();
    
    // Re-render the workout day to update progress
    this.renderWorkoutDay(day);
  }

  resetWorkoutDay(day) {
    if (confirm(`Reset all progress for ${day}? This cannot be undone.`)) {
      if (this.data.workoutState && this.data.workoutState[day]) {
        delete this.data.workoutState[day];
      }
      this.saveData();
      this.renderWorkoutDay(day);
    }
  }

  renderCalendar() {
    const section = document.getElementById('calendar');
    if (!section) return;
    section.innerHTML = `
      <div class="container" id="calendarContainer">
        <div class="section-header">
          <h1>Calendar View</h1>
          <p>View and manage your daily actions</p>
        </div>
        <div class="calendar-container">
          <div class="calendar-main">
            <div class="calendar-header">
              <button class="btn btn--outline" id="prevMonth">‹</button>
              <h3 id="currentMonth">June 2025</h3>
              <button class="btn btn--outline" id="nextMonth">›</button>
            </div>
            <div class="calendar-grid" id="calendarGrid"></div>
          </div>
          <div class="calendar-sidebar">
            <div class="card">
              <div class="card__body">
                <h3 id="selectedDateDisplay">Select a date</h3>
                <div class="selected-date-actions" id="selectedDateActions">
                  <p class="empty-state">No actions for this date</p>
                </div>
                <div class="calendar-action-form">
                  <select class="form-control" id="calendarActionType">
                    <option value="">Add action for this date...</option>
                  </select>
                  <button class="btn btn--primary btn--full-width" id="addCalendarAction">Add Action</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Re-attach event listeners for calendar navigation
    document.getElementById('prevMonth')?.addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('nextMonth')?.addEventListener('click', () => this.changeMonth(1));
    document.getElementById('addCalendarAction')?.addEventListener('click', () => this.addCalendarAction());
    
    // Populate dynamic content
    this.renderCalendarGrid();
    
    // Initialize selected date to today if not set
    if (!this.selectedDate) {
      this.selectedDate = new Date();
    }
    
    // Make sure the selected date is properly displayed
    this.updateSelectedDateActions();
    this.populateActionTypeSelects();
  }

  renderCalendarGrid() {
    const calendarGrid = document.getElementById('calendarGrid');
    const currentMonthElement = document.getElementById('currentMonth');
    if (!calendarGrid || !currentMonthElement) return;

    const currentDate = this.currentDate || new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update month display
    currentMonthElement.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
    
    // Generate calendar grid
    let calendarHTML = `
      <div class="calendar-weekdays">
        <div class="calendar-weekday">Sun</div>
        <div class="calendar-weekday">Mon</div>
        <div class="calendar-weekday">Tue</div>
        <div class="calendar-weekday">Wed</div>
        <div class="calendar-weekday">Thu</div>
        <div class="calendar-weekday">Fri</div>
        <div class="calendar-weekday">Sat</div>
      </div>
      <div class="calendar-days">
    `;
    
    const today = new Date();
    const todayStr = getDateString(today);
    
    // Generate 6 weeks of calendar
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        const currentCalendarDate = new Date(startDate);
        currentCalendarDate.setDate(startDate.getDate() + (week * 7) + day);
        
        const dateStr = getDateString(currentCalendarDate);
        const isCurrentMonth = currentCalendarDate.getMonth() === month;
        const isToday = dateStr === todayStr;
        const isSelected = this.selectedDate && getDateString(this.selectedDate) === dateStr;
        
        // Pre-calculate day actions for better performance
        const dayActions = this.data.actions ? this.data.actions.filter(action => 
          getDateString(action.date) === dateStr
        ) : [];
        
        const hasActions = dayActions.length > 0;
        const dayTotal = hasActions ? dayActions.reduce((sum, action) => sum + (action.value || 0), 0) : 0;
        
        const dayClasses = [
          'calendar-day',
          !isCurrentMonth ? 'empty' : '',
          isToday ? 'today' : '',
          isSelected ? 'selected' : '',
          hasActions ? 'has-actions' : ''
        ].filter(Boolean).join(' ');
        
        calendarHTML += `
          <div class="${dayClasses}" 
               data-date="${dateStr}"
               onclick="app.selectCalendarDate('${dateStr}')"
               title="${hasActions ? `Total: ${formatCurrency(dayTotal)}` : 'No actions'}">
            <span class="calendar-day-number">${currentCalendarDate.getDate()}</span>
            ${hasActions ? `<span class="calendar-day-indicator ${dayTotal >= 0 ? 'positive' : 'negative'}"></span>` : ''}
          </div>
        `;
      }
    }
    
    calendarHTML += '</div>';
    calendarGrid.innerHTML = calendarHTML;
  }

  renderProfile() {
    const section = document.getElementById('profile');
    if (!section) return;
    
    const settings = this.data.settings || { targetGoal: 20000, reminderTime: '20:00', theme: 'light', quickActions: [] };
    const positiveTypes = this.data.actionTypes?.positive || [];
    const negativeTypes = this.data.actionTypes?.negative || [];
    
    section.innerHTML = `
      <div class="container" id="profileContainer">
        <div class="section-header">
          <h1>Profile Settings</h1>
          <p>Customize your goals and action types</p>
        </div>
        
        <div class="profile-grid">
          <!-- Target Goal Settings -->
          <div class="card">
            <div class="card__body">
              <h3>Target Goal</h3>
              <div class="form-group">
                <label class="form-label">Starting Debt Amount (₹)</label>
                <input type="number" class="form-control" id="targetGoalInput" value="${settings.targetGoal || 20000}">
              </div>
              <div class="form-group">
                <label class="form-label">Daily Reminder</label>
                <input type="time" class="form-control" id="reminderTimeInput" value="${settings.reminderTime || '20:00'}">
              </div>
              <div class="form-group">
                <label class="form-label">Theme</label>
                <select class="form-control" id="themeSelect">
                  <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
                  <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                </select>
              </div>
              <button class="btn btn--primary" id="saveSettingsBtn">Save Settings</button>
              
              <div class="danger-zone" style="margin-top: var(--space-24); padding-top: var(--space-24); border-top: 1px solid var(--color-border);">
                <h4 style="color: var(--color-error); margin-bottom: var(--space-16);">Danger Zone</h4>
                <button class="btn btn--outline" id="resetDataBtn" style="border-color: var(--color-error); color: var(--color-error);">Reset All Data</button>
                <button class="btn btn--outline" id="removeDuplicatesBtn" style="border-color: var(--color-warning); color: var(--color-warning); margin-left: 8px;">Remove Duplicates</button>
              </div>
            </div>
          </div>

          <!-- Quick Actions Selection -->
          <div class="card">
            <div class="card__body">
              <h3>Quick Actions</h3>
              <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-16);">
                Select which actions appear in the dashboard quick actions section (up to 6)
              </p>
              <div id="quickActionsSelection">
                ${[...positiveTypes, ...negativeTypes].map(type => {
                  const isSelected = (settings.quickActions || []).includes(type.id);
                  return `
                    <div class="quick-action-option">
                      <label>
                        <input type="checkbox" value="${type.id}" ${isSelected ? 'checked' : ''}>
                        <span>${type.name} (${type.value > 0 ? '+' : ''}${type.value})</span>
                      </label>
                    </div>
                  `;
                }).join('')}
              </div>
              <button class="btn btn--secondary" id="saveQuickActionsBtn">Save Quick Actions</button>
            </div>
          </div>

          <!-- Positive Action Types -->
          <div class="card">
            <div class="card__body">
              <h3>Positive Actions</h3>
              <div class="action-types-list" id="positiveActionsList">
                ${positiveTypes.map(type => `
                  <div class="action-type-item">
                    <div class="action-type-info">
                      <span class="action-type-name">${type.name}</span>
                      <span class="action-type-value positive">+${formatCurrency(type.value)}</span>
                    </div>
                    <button class="btn btn--outline btn--sm" onclick="app.deleteActionType(${type.id})" title="Delete">🗑️</button>
                  </div>
                `).join('')}
              </div>
              <div class="add-action-type-form">
                <input type="text" class="form-control" id="newPositiveActionName" placeholder="Action name">
                <input type="number" class="form-control" id="newPositiveActionValue" placeholder="Points">
                <button class="btn btn--secondary" id="addPositiveActionTypeBtn">Add</button>
              </div>
            </div>
          </div>

          <!-- Negative Action Types -->
          <div class="card">
            <div class="card__body">
              <h3>Negative Actions</h3>
              <div class="action-types-list" id="negativeActionsList">
                ${negativeTypes.map(type => `
                  <div class="action-type-item">
                    <div class="action-type-info">
                      <span class="action-type-name">${type.name}</span>
                      <span class="action-type-value negative">${formatCurrency(type.value)}</span>
                    </div>
                    <button class="btn btn--outline btn--sm" onclick="app.deleteActionType(${type.id})" title="Delete">🗑️</button>
                  </div>
                `).join('')}
              </div>
              <div class="add-action-type-form">
                <input type="text" class="form-control" id="newNegativeActionName" placeholder="Action name">
                <input type="number" class="form-control" id="newNegativeActionValue" placeholder="Points (will be negative)">
                <button class="btn btn--secondary" id="addNegativeActionTypeBtn">Add</button>
              </div>
            </div>
          </div>

          <!-- Badge Progress -->
          <div class="card">
            <div class="card__body">
              <h3>Badge Progress</h3>
              <div class="badge-progress-list" id="badgeProgressList">
                <!-- This will be populated by renderBadges -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Attach event listeners
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('resetDataBtn')?.addEventListener('click', () => this.resetAllData());
    document.getElementById('removeDuplicatesBtn')?.addEventListener('click', () => this.removeDuplicateDefaultActions());
    document.getElementById('saveQuickActionsBtn')?.addEventListener('click', () => this.saveQuickActions());
    document.getElementById('addPositiveActionTypeBtn')?.addEventListener('click', () => this.addActionType('positive'));
    document.getElementById('addNegativeActionTypeBtn')?.addEventListener('click', () => this.addActionType('negative'));
    
    // Render badges in the badge progress section
    this.renderBadges();
  }

  async saveQuickActions() {
    const checkboxes = document.querySelectorAll('#quickActionsSelection input[type="checkbox"]');
    const selected = Array.from(checkboxes)
      .filter(c => c.checked)
      .map(c => parseInt(c.value))
      .slice(0, CONFIG.MAX_QUICK_ACTIONS); // Limit quick actions per config
    
    // Remove duplicates and update settings
    this.data.settings.quickActions = [...new Set(selected)];
    await this.saveData();
          // REMOVED: No notification for saving quick actions
    this.renderQuickActions(); // Re-render to show changes
  }

  async addActionType(category, isDefault = false) {
    const name = document.getElementById(`new${category.charAt(0).toUpperCase() + category.slice(1)}ActionName`).value.trim();
    const valueInput = document.getElementById(`new${category.charAt(0).toUpperCase() + category.slice(1)}ActionValue`);
    let value = parseInt(valueInput.value);
    
    // Enhanced validation
    if (!name) {
      this.showNotification('Please enter a name for the action type.', 'error');
      return;
    }
    
    if (name.length < CONFIG.MIN_ACTION_TYPE_NAME_LENGTH) {
      this.showNotification(`Action type name must be at least ${CONFIG.MIN_ACTION_TYPE_NAME_LENGTH} characters long.`, 'error');
      return;
    }
    
    if (name.length > CONFIG.MAX_ACTION_TYPE_NAME_LENGTH) {
      this.showNotification(`Action type name must be less than ${CONFIG.MAX_ACTION_TYPE_NAME_LENGTH} characters.`, 'error');
      return;
    }
    
    if (isNaN(value) || value === 0) {
      this.showNotification('Please enter a valid non-zero value.', 'error');
      return;
    }
    
    if (Math.abs(value) > CONFIG.MAX_ACTION_VALUE) {
      this.showNotification(`Value cannot exceed ±${CONFIG.MAX_ACTION_VALUE} points.`, 'error');
      return;
    }
    
    // Ensure negative values for negative category
    if (category === 'negative' && value > 0) value = -value;
    
    // Ensure positive values for positive category  
    if (category === 'positive' && value < 0) value = Math.abs(value);

    try {
      // Check for duplicate name in same category
      const { data: existing, error: checkError } = await supabase
        .from('action_types')
        .select('id')
        .eq('user_id', this.user.id)
        .eq('name', name)
        .eq('category', category);

      if (checkError) {
        this.showNotification('Error checking for duplicates.', 'error');
        return;
      }

      if (existing && existing.length > 0) {
        this.showNotification('An action type with this name already exists in this category.', 'error');
        return;
      }

      const { error } = await supabase
        .from('action_types')
        .insert({
          name,
          value,
          category,
          is_default: false,
          user_id: this.user.id
        });

      if (!error) {
        this.showConfirmationModal(
          'Action Type Added!',
          `Successfully added "${name}" to ${category} actions with value ${value > 0 ? '+' : ''}${formatCurrency(value)}.`,
          'success'
        );
        await this.loadActionTypes();
        this.renderProfile();
        this.renderQuickActions();
        this.populateActionTypeSelects();
        valueInput.value = '';
        document.getElementById(`new${category.charAt(0).toUpperCase() + category.slice(1)}ActionName`).value = '';
      } else {
        console.error('Database error adding action type:', error);
        if (error.code === '23505') {
          this.showConfirmationModal(
            'Duplicate Action Type',
            'An action type with this name already exists. Please choose a different name.',
            'warning'
          );
        } else {
          this.showConfirmationModal(
            'Database Error',
            'Failed to save action type to database. Please try again.',
            'error'
          );
        }
      }
    } catch (error) {
      console.error('Error adding action type:', error);
      if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        this.showConfirmationModal(
          'Connection Error',
          'Unable to add action type due to network issues. Please check your connection and try again.',
          'error'
        );
      } else {
        this.showConfirmationModal(
          'Unexpected Error',
          'An unexpected error occurred while adding the action type. Please try again.',
          'error'
        );
      }
    }
  }

  async deleteActionType(actionTypeId) {
    if (!confirm('Are you sure you want to delete this action type? This will also delete all associated actions.')) {
      return;
    }

    try {
      // First delete all actions of this type
      const { error: actionsError } = await supabase
        .from('actions')
        .delete()
        .eq('user_id', this.user.id)
        .eq('action_type_id', actionTypeId);

      if (actionsError) {
        console.error('Error deleting actions:', actionsError);
        this.showNotification('Error deleting associated actions.', 'error');
        return;
      }

      // Then delete the action type
      const { error: typeError } = await supabase
        .from('action_types')
        .delete()
        .eq('id', actionTypeId)
        .eq('user_id', this.user.id);

      if (!typeError) {
        this.showNotification('Action type deleted!', 'success');
        await this.loadActionTypes();
        this.renderProfile();
        this.renderQuickActions();
        this.populateActionTypeSelects();
        this.renderRecentActivities();
      } else {
        console.error('Error deleting action type:', typeError);
        this.showNotification('Failed to delete action type.', 'error');
      }
    } catch (error) {
      console.error('Error in deleteActionType:', error);
      this.showNotification('An error occurred while deleting the action type.', 'error');
    }
  }

  async removeDuplicateDefaultActions() {
    if (!this.user) {
      this.showNotification('User not logged in.', 'error');
      return;
    }

    if (!confirm('Are you sure you want to remove duplicate action types? This action cannot be undone.')) {
      return;
    }

    try {
      // Get all action types for current user
      const { data: actionTypes, error } = await supabase
        .from('action_types')
        .select('*')
        .eq('user_id', this.user.id)
        .order('id', { ascending: true });
        
      if (error) {
        console.error('Error fetching action types:', error);
        this.showNotification('Failed to fetch action types.', 'error');
        return;
      }

      if (!actionTypes || actionTypes.length === 0) {
        this.showNotification('No action types found.', 'info');
        return;
      }

      // Build a map: key = name|category|value, value = array of action type objects
      const keyMap = {};
      for (const type of actionTypes) {
        const key = `${type.name.trim().toLowerCase()}|${type.category}|${type.value}`;
        if (!keyMap[key]) keyMap[key] = [];
        keyMap[key].push(type);
      }

      // For each key, keep the first (lowest ID), delete the rest
      const toDelete = [];
      const toKeep = [];
      Object.entries(keyMap).forEach(([key, arr]) => {
        if (arr.length > 1) {
          // Sort by ID ascending, keep the first
          arr.sort((a, b) => a.id - b.id);
          const keep = arr[0];
          const remove = arr.slice(1);
          toKeep.push(keep);
          remove.forEach(type => toDelete.push(type.id));
          console.log(`Duplicate key: ${key} - Keeping ID ${keep.id}, deleting IDs:`, remove.map(t => t.id));
        }
      });

      if (toDelete.length === 0) {
        this.showNotification('No duplicate action types found.', 'info');
        return;
      }

      // Before deleting, update any existing actions that reference the duplicate action types
      for (const duplicateId of toDelete) {
        // Find which action type should replace this duplicate
        const duplicateType = actionTypes.find(at => at.id === duplicateId);
        if (!duplicateType) continue;

        const keepType = toKeep.find(kt => 
          kt.name.trim().toLowerCase() === duplicateType.name.trim().toLowerCase() &&
          kt.category === duplicateType.category &&
          kt.value === duplicateType.value
        );

        if (keepType) {
          // Update actions that reference the duplicate to use the keeper
          const { error: updateError } = await supabase
            .from('actions')
            .update({ action_type_id: keepType.id })
            .eq('user_id', this.user.id)
            .eq('action_type_id', duplicateId);

          if (updateError) {
            console.error('Error updating action references:', updateError);
          } else {
            console.log(`Updated actions referencing duplicate ${duplicateId} to use ${keepType.id}`);
          }
        }
      }

      // Delete all duplicates from DB
      const { error: delError } = await supabase
        .from('action_types')
        .delete()
        .in('id', toDelete)
        .eq('user_id', this.user.id); // Extra safety check

      if (delError) {
        console.error('Error deleting duplicates:', delError);
        this.showNotification('Failed to delete duplicate action types.', 'error');
        return;
      }

      this.showNotification(`Removed ${toDelete.length} duplicate action type${toDelete.length > 1 ? 's' : ''}!`, 'success');
      
      // Reload data and update UI
      await this.loadActionTypes();
      this.renderAll();
      
    } catch (error) {
      console.error('Error removing duplicates:', error);
      this.showNotification('An error occurred while removing duplicates.', 'error');
    }
  }

  showCustomWorkoutModal(day) {
    let modal = document.querySelector('.custom-workout-modal');
    if (modal) modal.remove();

    // Get ALL exercises - from custom workout if exists, otherwise from default routine
    const customWorkout = this.data.customWorkouts && this.data.customWorkouts[day];
    const defaultRoutine = this.workoutRoutines[day];
    
    let currentExercises = [];
    if (customWorkout && customWorkout.exercises) {
      currentExercises = customWorkout.exercises;
    } else if (defaultRoutine && defaultRoutine.phases) {
      // Extract exercises from all phases of default routine
      defaultRoutine.phases.forEach(phase => {
        if (phase.exercises) {
          phase.exercises.forEach(exercise => {
            if (exercise.sets && exercise.reps) {
              currentExercises.push({
                name: exercise.name,
                sets: exercise.sets,
                reps: exercise.reps,
                notes: exercise.notes || ''
              });
            }
          });
        }
      });
    }

    const exercisesHTML = currentExercises.map((ex, index) => `
      <div class="exercise-item" data-index="${index}">
        <div class="exercise-inputs">
          <div class="input-group">
            <label>Exercise Name</label>
            <input type="text" class="exercise-input" value="${ex.name}" placeholder="e.g., Push-ups">
          </div>
          <div class="input-group">
            <label>Sets</label>
            <input type="number" class="exercise-input" value="${ex.sets || ''}" placeholder="3" min="1">
          </div>
          <div class="input-group">
            <label>Reps</label>
            <input type="text" class="exercise-input" value="${ex.reps || ''}" placeholder="e.g., 10-12">
          </div>
        </div>
        <button class="remove-exercise-btn" onclick="this.parentElement.remove()" title="Remove exercise">
          <span>🗑️</span>
        </button>
      </div>
    `).join('');

    document.body.insertAdjacentHTML('beforeend', `
      <div class="custom-workout-modal">
        <div class="modal-backdrop" onclick="document.querySelector('.custom-workout-modal').remove()"></div>
        <div class="custom-workout-modal-content">
          <div class="modal-header">
            <h3>Custom Workout for ${day}</h3>
            <button class="modal-close" onclick="document.querySelector('.custom-workout-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="exercises-section">
              <div class="section-title">
                <h4>Exercises</h4>
                <button class="btn-add-exercise" onclick="app.addCustomExerciseField()">
                  <span>+</span> Add Exercise
                </button>
              </div>
              <div id="custom-exercises-container" class="exercises-container">
                ${exercisesHTML || '<div class="no-exercises">No exercises added yet. Click "Add Exercise" to start.</div>'}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--outline" onclick="document.querySelector('.custom-workout-modal').remove()">Cancel</button>
            <button class="btn btn--primary" onclick="app.saveCustomWorkout('${day}')">Save Workout</button>
          </div>
        </div>
      </div>
    `);
  }

  addCustomExerciseField() {
    const container = document.getElementById('custom-exercises-container');
    
    // Remove the "no exercises" message if it exists
    const noExercisesMsg = container.querySelector('.no-exercises');
    if (noExercisesMsg) {
      noExercisesMsg.remove();
    }
    
    container.insertAdjacentHTML('beforeend', `
      <div class="exercise-item">
        <div class="exercise-inputs">
          <div class="input-group">
            <label>Exercise Name</label>
            <input type="text" class="exercise-input" placeholder="e.g., Push-ups">
          </div>
          <div class="input-group">
            <label>Sets</label>
            <input type="number" class="exercise-input" placeholder="3" min="1">
          </div>
          <div class="input-group">
            <label>Reps</label>
            <input type="text" class="exercise-input" placeholder="e.g., 10-12">
          </div>
        </div>
        <button class="remove-exercise-btn" onclick="this.parentElement.remove()" title="Remove exercise">
          <span>🗑️</span>
        </button>
      </div>
    `);
  }

  async saveCustomWorkout(day) {
    const container = document.getElementById('custom-exercises-container');
    const exercises = [];
    container.querySelectorAll('.exercise-item').forEach(item => {
      const inputs = item.querySelectorAll('.exercise-input');
      const name = inputs[0].value.trim();
      const sets = parseInt(inputs[1].value, 10);
      const reps = inputs[2].value.trim();
      if (name && sets > 0 && reps) {
        exercises.push({ name, sets, reps, notes: 'Custom exercise' });
      }
    });

        if (exercises.length > 0) {
      if (!this.data.customWorkouts) {
        this.data.customWorkouts = {};
      }
      this.data.customWorkouts[day] = {
        focus: "Custom Workout",
        totalTime: "Variable",
        exercises: exercises,
        phases: [
          {
            type: "single",
            name: "Custom Exercises",
            exercises: exercises
          }
        ]
      };
      // The renderWorkoutDay function will automatically use customWorkouts over defaults
      
      // Save to database
      await this.saveData();
      this.showNotification('Custom workout saved!', 'success');
    } else {
      delete this.data.customWorkouts[day];
              // Don't modify this.workoutRoutines[day] as it contains the original defaults
        await this.saveData();
      this.showNotification('Custom workout cleared.', 'info');
    }
    
    document.querySelector('.custom-workout-modal').remove();
    this.renderWorkoutDay(day);
  }

  async addCalendarAction() {
    const select = document.getElementById('calendarActionType');
    const actionTypeId = parseInt(select.value);
    
    if (!actionTypeId) {
      this.showNotification('Please select an action type', 'error');
      return;
    }

    // Use selected date, or today if no date is selected
    const targetDate = this.selectedDate || new Date();
    const dateString = getDateString(targetDate);
    
    await this.addAction(actionTypeId, 0, '', dateString, false); // Manual action from calendar
    
    // Refresh calendar and selected date display
    this.renderCalendarGrid(); // Only re-render the grid, not the whole calendar
    this.updateSelectedDateActions();
    
    // Reset select
    select.value = '';
  }

  // Data Export/Backup Feature
  async exportData() {
    const dataToExport = {
      actions: this.data.actions,
      settings: this.data.settings,
      workoutProgress: this.data.workoutProgress,
      customWorkouts: this.data.customWorkouts,
      workoutState: this.data.workoutState,
      actionTypes: this.data.actionTypes,
      exportDate: new Date().toISOString(),
      appVersion: "1.0.0"
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habitide-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showNotification('Data exported successfully!', 'success');
  }

  async importData(file) {
    try {
      // Enhanced file validation
      if (!file || !file.size) {
        throw new Error('No file selected or file is empty');
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File is too large. Maximum size is 10MB.');
      }

      if (!file.name.toLowerCase().endsWith('.json')) {
        throw new Error('Invalid file format. Please select a JSON file.');
      }

      const text = await file.text();
      let importedData;
      
      try {
        importedData = JSON.parse(text);
      } catch (parseError) {
        throw new Error('Invalid JSON format. File may be corrupted.');
      }
      
      // Enhanced data validation with integrity checks
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Invalid backup file structure');
      }

      if (!importedData.actions || !Array.isArray(importedData.actions)) {
        throw new Error('Invalid actions data in backup file');
      }
      
      if (!importedData.settings || typeof importedData.settings !== 'object') {
        throw new Error('Invalid settings data in backup file');
      }

      // Validate critical data structures
      const requiredFields = ['actions', 'settings'];
      for (const field of requiredFields) {
        if (!(field in importedData)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate action data integrity
      const invalidActions = importedData.actions.filter(action => {
        return !action.id || !action.action_type_id || !action.date;
      });

      if (invalidActions.length > 0) {
        throw new Error(`Found ${invalidActions.length} invalid action(s) in backup file`);
      }

      // Validate date formats in actions
      const invalidDates = importedData.actions.filter(action => {
        try {
          const date = new Date(action.date);
          return isNaN(date.getTime());
        } catch {
          return true;
        }
      });

      if (invalidDates.length > 0) {
        throw new Error(`Found ${invalidDates.length} action(s) with invalid dates`);
      }

      // Show confirmation with data summary
      const exportDate = importedData.exportDate ? 
        new Date(importedData.exportDate).toLocaleDateString() : 
        'unknown date';
      
      const actionCount = importedData.actions.length;
      const confirmMessage = `Import data from ${exportDate}?\n\nThis will import ${actionCount} action(s) and overwrite your current data.\n\nThis action cannot be undone.`;
      
      const confirmImport = confirm(confirmMessage);
      
      if (!confirmImport) return;
      
      // Create backup of current data before import
      const currentBackup = {
        actions: [...this.data.actions],
        settings: { ...this.data.settings },
        workoutProgress: { ...this.data.workoutProgress },
        customWorkouts: { ...this.data.customWorkouts },
        workoutState: { ...this.data.workoutState },
        actionTypes: { ...this.data.actionTypes },
        backupDate: new Date().toISOString()
      };

      try {
        // Import data with proper merging and validation
        this.data.actions = importedData.actions.map(action => ({
          ...action,
          // Ensure consistent data structure
          id: action.id,
          action_type_id: action.action_type_id,
          date: getDateString(action.date),
          notes: sanitizeInput(action.notes || ''),
          user_id: this.user.id // Ensure proper user association
        }));

        // Merge settings carefully, preserving current user-specific settings
        this.data.settings = {
          ...this.data.settings,
          ...importedData.settings,
          // Preserve critical user settings
          userId: this.user.id
        };

        // Import optional data structures with fallbacks
        this.data.workoutProgress = importedData.workoutProgress || {};
        this.data.customWorkouts = importedData.customWorkouts || {};
        this.data.workoutState = importedData.workoutState || {};
        
        if (importedData.actionTypes && 
            importedData.actionTypes.positive && 
            importedData.actionTypes.negative) {
          this.data.actionTypes = importedData.actionTypes;
        }

        // Invalidate caches after import
        this.invalidateStatsCache();
        
        // Save data with validation
        await this.saveData();
        
        this.showNotification(MESSAGES.SUCCESS.DATA_IMPORTED, 'success');
        this.renderAll();
        
      } catch (saveError) {
        // Restore backup on save failure
        console.error('Failed to save imported data, restoring backup:', saveError);
        this.data = {
          actions: currentBackup.actions,
          settings: currentBackup.settings,
          workoutProgress: currentBackup.workoutProgress,
          customWorkouts: currentBackup.customWorkouts,
          workoutState: currentBackup.workoutState,
          actionTypes: currentBackup.actionTypes
        };
        
        throw new Error('Failed to save imported data. Your original data has been restored.');
      }
      
    } catch (error) {
      console.error('Import error:', error);
      this.showNotification(`Import failed: ${error.message}`, 'error');
    }
  }

  // Notification System
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.setupDailyReminder();
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.showNotification('Notifications enabled! You\'ll get daily reminders.', 'success');
        this.setupDailyReminder();
        return true;
      }
    }
    
    return false;
  }

  setupDailyReminder() {
    // Clear any existing reminder
    if (this.reminderTimeout) {
      clearTimeout(this.reminderTimeout);
    }

    const reminderTime = this.data.settings.reminderTime || '20:00';
    const [hours, minutes] = reminderTime.split(':').map(Number);
    
    const scheduleNextReminder = () => {
      const now = new Date();
      const reminder = new Date();
      reminder.setHours(hours, minutes, 0, 0);
      
      // If the time has passed today, schedule for tomorrow
      if (reminder <= now) {
        reminder.setDate(reminder.getDate() + 1);
      }
      
      const timeUntilReminder = reminder.getTime() - now.getTime();
      
      this.reminderTimeout = setTimeout(() => {
        this.sendDailyReminder();
        scheduleNextReminder(); // Schedule the next one
      }, timeUntilReminder);
    };

    scheduleNextReminder();
  }

  sendDailyReminder() {
    if (Notification.permission === 'granted') {
      const today = new Date();
      const todayStr = getDateString(today);
      const todayActions = this.data.actions.filter(a => getDateString(a.date) === todayStr);
      
      let title = '🎯 Habitide Daily Reminder';
      let body = 'Time to track your daily habits!';
      
      if (todayActions.length === 0) {
        body = 'You haven\'t logged any actions today. Start building your habits!';
      } else {
        body = `Great job! You've completed ${todayActions.length} action${todayActions.length > 1 ? 's' : ''} today. Keep it up!`;
      }

      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'daily-reminder'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 10000); // Auto-close after 10 seconds
    }
  }

  // Helper function to diagnose database issues - call from browser console: app.diagnoseDatabaseIssues()
  async diagnoseDatabaseIssues() {
    if (!this.user) {
      console.log("HabitideApp: DIAGNOSTIC - No user logged in");
      return;
    }
    
    console.log("HabitideApp: DIAGNOSTIC - Starting database diagnostics...");
    console.log("HabitideApp: DIAGNOSTIC - User ID:", this.user.id);
    
    // Test database connection
    try {
      const { data, error } = await supabase.from('user_settings').select('*').limit(1);
      if (error) {
        console.error("HabitideApp: DIAGNOSTIC - Database connection error:", error);
      } else {
        console.log("HabitideApp: DIAGNOSTIC - Database connection successful");
      }
    } catch (e) {
      console.error("HabitideApp: DIAGNOSTIC - Exception during database test:", e);
    }
    
    // Test current settings
    console.log("HabitideApp: DIAGNOSTIC - Current settings object:", this.data.settings);
    
    // Test action types
    console.log("HabitideApp: DIAGNOSTIC - Action types:", this.data.actionTypes);
    
    // Test actions in local data vs database
    console.log("HabitideApp: DIAGNOSTIC - Local actions count:", this.data.actions.length);
    console.log("HabitideApp: DIAGNOSTIC - Recent local actions:", this.data.actions.slice(0, 5));
    
    try {
      const { data: dbActions, error } = await supabase
        .from('actions')
        .select('*')
        .eq('user_id', this.user.id)
        .order('date', { ascending: false })
        .limit(5);
        
      if (error) {
        console.error("HabitideApp: DIAGNOSTIC - Error fetching actions from DB:", error);
      } else {
        console.log("HabitideApp: DIAGNOSTIC - Database actions count:", dbActions.length);
        console.log("HabitideApp: DIAGNOSTIC - Recent database actions:", dbActions);
      }
    } catch (e) {
      console.error("HabitideApp: DIAGNOSTIC - Exception fetching actions:", e);
    }
  }

  async ensureUserHasDefaultActionTypes() {
    if (!this.user) {
      console.warn('Cannot seed action types: no user logged in');
      return false;
    }

    try {
      // Check if user already has action types
      const { data: existing, error: checkError } = await supabase
        .from('action_types')
        .select('id')
        .eq('user_id', this.user.id)
        .limit(1);

      if (checkError) {
        console.error('Error checking existing action types:', checkError);
        return false;
      }

      if (existing && existing.length > 0) {
        console.log('User already has action types, skipping seeding');
        return true;
      }

      // Default actions to seed
      const defaultActions = [
        // Positive
        { name: 'Gym/Exercise', value: 1000, category: 'positive' },
        { name: 'Healthy Meal', value: 500, category: 'positive' },
        { name: 'Meditation', value: 300, category: 'positive' },
        { name: 'Study/Learning', value: 750, category: 'positive' },
        { name: 'Early Sleep', value: 250, category: 'positive' },
        { name: 'No Social Media', value: 400, category: 'positive' },
        { name: 'Water Goal Met', value: 200, category: 'positive' },
        { name: 'Read Book', value: 600, category: 'positive' },
        // Negative
        { name: 'Fast Food', value: -500, category: 'negative' },
        { name: 'Skipped Workout', value: -750, category: 'negative' },
        { name: 'Late Night Scrolling', value: -400, category: 'negative' },
        { name: 'Procrastination', value: -300, category: 'negative' },
        { name: 'Junk Food', value: -350, category: 'negative' },
        { name: 'Missed Deadline', value: -800, category: 'negative' },
        { name: 'Excessive Shopping', value: -1000, category: 'negative' }
      ];

      // Insert all for this user
      const { data, error } = await supabase.from('action_types').insert(
        defaultActions.map(a => ({ ...a, is_default: true, user_id: this.user.id }))
      );

      if (error) {
        console.error('Error seeding default action types:', error);
        return false;
      }

      console.log(`Successfully seeded ${defaultActions.length} default action types for user ${this.user.id}`);
      return true;
    } catch (error) {
      console.error('Exception in ensureUserHasDefaultActionTypes:', error);
      return false;
    }
  }

  ensureMainSectionsExist() {
    // Check if main-content exists
    let mainContent = document.querySelector('.main-content');
    if (!mainContent) {
      mainContent = document.createElement('main');
      mainContent.className = 'main-content';
      document.body.appendChild(mainContent);
    }
    // Section definitions
    const sections = [
      { id: 'dashboard', active: true },
      { id: 'workout', active: false },
      { id: 'calendar', active: false },
      { id: 'profile', active: false }
    ];
    // For each section, ensure it exists
    sections.forEach(({ id, active }) => {
      let section = document.getElementById(id);
      if (!section) {
        section = document.createElement('section');
        section.id = id;
        section.className = 'section' + (active ? ' active' : '');
        section.innerHTML = '';
        mainContent.appendChild(section);
      }
    });
  }

  calculateStats() {
    const actions = this.data.actions || [];
    const settings = this.data.settings || {};
    const targetGoal = settings.targetGoal || 0;
    
    let totalEarned = 0;
    let totalLost = 0;
    let currentDebt = targetGoal; // Start with the debt amount
    
    actions.forEach(action => {
      // Use the action's stored value instead of looking up action type
      const value = action.value || 0;
        if (value > 0) {
          totalEarned += value;
        currentDebt -= value; // SUBTRACT positive points from debt
        } else {
        totalLost += Math.abs(value); // Store as positive for display
        currentDebt += Math.abs(value); // ADD negative points to debt
      }
    });
    
    // Ensure debt doesn't go below 0
    currentDebt = Math.max(0, currentDebt);
    
    return {
      totalEarned,
      totalLost,
      currentDebt,
      targetGoal
    };
  }

  updateDashboardStats() {
    const stats = this.calculateStats();
    const format = formatCurrency;
    const settings = this.data.settings || {};
    
    const targetGoalDisplay = document.getElementById('targetGoalDisplay');
    const currentLevelDisplay = document.getElementById('currentLevelDisplay');
    const totalEarned = document.getElementById('totalEarned');
    const totalLost = document.getElementById('totalLost');

    
    if (targetGoalDisplay) targetGoalDisplay.textContent = format(settings.targetGoal || 0);
    if (currentLevelDisplay) currentLevelDisplay.textContent = format(stats.currentDebt || 0);
    if (totalEarned) totalEarned.textContent = format(stats.totalEarned || 0);
    if (totalLost) totalLost.textContent = format(stats.totalLost || 0);

  }

  findActionType(typeId) {
    const actionTypesData = this.data.actionTypes || { positive: [], negative: [] };
    const allActionTypes = [
      ...(Array.isArray(actionTypesData.positive) ? actionTypesData.positive : []),
      ...(Array.isArray(actionTypesData.negative) ? actionTypesData.negative : [])
    ];
    return allActionTypes.find(type => type.id === typeId);
  }

  populateActionTypeSelects() {
    const selects = document.querySelectorAll('#addActionType, #calendarActionType');
    const actionTypesData = this.data.actionTypes || { positive: [], negative: [] };
    
    // Combine positive and negative action types into a single array
    const actionTypes = [
      ...(Array.isArray(actionTypesData.positive) ? actionTypesData.positive : []),
      ...(Array.isArray(actionTypesData.negative) ? actionTypesData.negative : [])
    ];
    
    selects.forEach(select => {
      if (!select) return;
      
      // Keep the first option (placeholder)
      const placeholder = select.querySelector('option[value=""]');
      select.innerHTML = '';
      if (placeholder) {
        select.appendChild(placeholder);
      }
      
      // Add action types
      actionTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.id;
        option.textContent = `${type.name} (${type.value > 0 ? '+' : ''}${formatCurrency(type.value)})`;
        select.appendChild(option);
      });
    });
  }

  renderQuickActions() {
    const container = document.getElementById('quickActionsContainer');
    if (!container) return;
    
    // Prevent duplicate rendering
    if (container.dataset.rendered === 'true') return;
    
    const settings = this.data.settings || {};
    const selectedActionIds = settings.quickActions || [];
    
    const actionTypesData = this.data.actionTypes || { positive: [], negative: [] };
    const allActionTypes = [
      ...(Array.isArray(actionTypesData.positive) ? actionTypesData.positive : []),
      ...(Array.isArray(actionTypesData.negative) ? actionTypesData.negative : [])
    ];
    
    // If no quick actions selected or selected actions don't exist, show the first 4 available action types
    let selectedActionTypes = [];
    if (selectedActionIds.length > 0) {
      selectedActionTypes = allActionTypes.filter(type => selectedActionIds.includes(type.id));
    }
    
    // If no valid selected actions, use first 4 available action types as fallback
    if (selectedActionTypes.length === 0 && allActionTypes.length > 0) {
      selectedActionTypes = allActionTypes.slice(0, 4);
    }
    
    if (selectedActionTypes.length === 0) {
      container.innerHTML = `
        <div class="empty-state-modern">
          <p>No action types available.</p>
          <p style="font-size: 0.875rem; margin-top: 8px; color: var(--color-text-secondary);">
            Go to <strong>Profile</strong> to add action types, then select which ones appear here as quick actions.
          </p>
        </div>
      `;
      return;
    }
    
    const todayStr = getDateString(new Date());
    const todayActions = (this.data.actions || []).filter(action => 
      getDateString(new Date(action.date)) === todayStr
    );
    
    let html = '';
    
    selectedActionTypes.forEach(type => {
      const hasActionToday = todayActions.some(action => action.action_type_id === type.id);
      const buttonClass = hasActionToday ? 'action-button completed' : 'action-button';
      
      html += `
        <button class="${buttonClass}" 
                onclick="app.addQuickAction(${type.id})" 
                ${hasActionToday ? 'disabled' : ''}
                title="${hasActionToday ? 'Already completed today' : 'Click to mark as completed today'}">
          <div class="action-name">${type.name}</div>
          <div class="action-value ${type.value >= 0 ? 'positive' : 'negative'}">
            ${type.value >= 0 ? '+' : ''}${formatCurrency(type.value)}
          </div>
          <div class="action-button-icon">
            ${hasActionToday ? '✓' : '+'}
          </div>
        </button>
      `;
    });
    
    container.innerHTML = html;
    container.dataset.rendered = 'true';
  }

  renderRecentActivities() {
    const container = document.getElementById('recentActivities');
    if (!container) return;
    
    const actions = this.data.actions || [];
    const recentActions = actions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
    
    if (recentActions.length === 0) {
      container.innerHTML = '<div class="empty-state-modern">No recent activities</div>';
      return;
    }
    
    let html = '';
    
    recentActions.forEach(action => {
      const actionType = this.findActionType(action.action_type_id);
      if (!actionType) return;
      
      const date = new Date(action.date);
      const dateStr = date.toLocaleDateString();
      const value = action.value || 0;
      
      html += `
        <div class="activity-card">
          <div class="activity-main">
            <div class="activity-name">${actionType.name}</div>
            <div class="activity-date">${dateStr}</div>
            ${action.notes ? `<div class="activity-notes">${action.notes}</div>` : ''}
          </div>
          <div class="activity-value ${value >= 0 ? 'positive' : 'negative'}">
            ${value >= 0 ? '+' : ''}${formatCurrency(value)}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }

  renderBadges() {
    const container = document.getElementById('badgeProgressList');
    if (!container) {
      console.log('Badge container not found');
      return;
    }
    
    // Calculate badge progress dynamically
    this.calculateBadgeProgress();
    
    if (!this.data.badges || this.data.badges.length === 0) {
      container.innerHTML = '<div class="empty-state">No badges available</div>';
      return;
    }

    let html = '';
    
    this.data.badges.forEach(badge => {
      const progress = this.getBadgeProgress(badge);
      const percentage = Math.min((progress / badge.requirement) * 100, 100);
      const isEarned = badge.earned || progress >= badge.requirement;
      
      html += `
        <div class="badge-item ${isEarned ? 'earned' : ''}">
          <div class="badge-icon">${badge.icon}</div>
          <div class="badge-info">
            <h4>${badge.name}</h4>
            <p>${badge.description}</p>
            <div class="badge-progress">${this.formatBadgeProgress(badge, progress)}</div>
          </div>
        </div>
      `;
    });
    
    if (html === '') {
      html = '<div class="empty-state">No badges available</div>';
    }
    container.innerHTML = html;
    console.log('Badges rendered:', this.data.badges.length);
  }

  // Helper method to calculate badge progress
  calculateBadgeProgress() {
    if (!this.data.badges || !this.data.actions) return;
    
    // Calculate various metrics for badge progress
    const actions = this.data.actions || [];
    const positiveActions = actions.filter(a => {
      const actionType = this.findActionType(a.action_type_id);
      return actionType && actionType.value > 0;
    });
    
    // Update badge progress and earned status
    this.data.badges.forEach(badge => {
      const progress = this.getBadgeProgress(badge);
      if (progress >= badge.requirement && !badge.earned) {
        badge.earned = true;
        // Could show a badge earned notification here if desired
      }
    });
  }

  // Helper method to get progress for a specific badge
  getBadgeProgress(badge) {
    if (!this.data.actions) return 0;
    
    const actions = this.data.actions || [];
    const stats = this.calculateStats();
    
    switch (badge.type) {
      case 'milestone':
        // First action completed
        return actions.length > 0 ? 1 : 0;
        
      case 'streak':
        // Calculate current streak
        return this.calculateCurrentStreak();
        
      case 'savings':
        // Calculate debt reduction percentage
        const targetGoal = this.data.settings.targetGoal || 20000;
        const currentDebt = targetGoal - stats.totalEarned + Math.abs(stats.totalLost);
        const debtReduction = Math.max(0, (targetGoal - currentDebt) / targetGoal);
        return debtReduction;
        
      case 'actions':
        // Count positive actions
        const positiveActions = actions.filter(a => {
          const actionType = this.findActionType(a.action_type_id);
          return actionType && actionType.value > 0;
        });
        return positiveActions.length;
        
      default:
        return 0;
    }
  }

  // Helper method to format badge progress text
  formatBadgeProgress(badge, progress) {
    switch (badge.type) {
      case 'milestone':
        return progress >= badge.requirement ? 'Complete!' : 'Not started';
        
      case 'streak':
        return `${Math.floor(progress)}/${badge.requirement} days`;
        
      case 'savings':
        const percentage = Math.min((progress / badge.requirement) * 100, 100);
        return `${percentage.toFixed(1)}% / ${(badge.requirement * 100).toFixed(0)}%`;
        
      case 'actions':
        return `${Math.floor(progress)}/${badge.requirement} actions`;
        
      default:
        return `${Math.floor(progress)}/${badge.requirement}`;
    }
  }

  // Helper method to calculate current streak
  calculateCurrentStreak() {
    if (!this.data.actions || this.data.actions.length === 0) return 0;
    
    const actions = this.data.actions || [];
    const sortedActions = actions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Check if we have an action today or yesterday (to allow for current day)
    const today = getDateString(new Date());
    const yesterday = getDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    
    let hasRecentAction = sortedActions.some(action => {
      const actionDate = getDateString(new Date(action.date));
      return actionDate === today || actionDate === yesterday;
    });
    
    if (!hasRecentAction) return 0;
    
    // Count consecutive days with actions
    const actionDates = new Set(actions.map(action => getDateString(new Date(action.date))));
    
    // Start from yesterday (or today if no action yesterday) and count backwards
    let checkDate = new Date();
    if (!actionDates.has(today)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (actionDates.has(getDateString(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    return streak;
  }

  // Calendar date selection methods
  selectCalendarDate(dateStr) {
    // Parse date string safely to avoid timezone issues
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      this.selectedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      this.selectedDate = new Date(dateStr);
    }
    this.renderCalendarGrid(); // Re-render to show selection
    this.updateSelectedDateActions(); // Update the selected date actions display
  }

  updateSelectedDateActions() {
    const container = document.getElementById('selectedDateActions');
    const displayElement = document.getElementById('selectedDateDisplay');
    
    if (!container || !this.selectedDate) return;

    // Update the date display header
    if (displayElement) {
      displayElement.textContent = this.selectedDate.toLocaleDateString();
    }

    const dateStr = getDateString(this.selectedDate);
    const dateActions = this.data.actions.filter(action => 
      getDateString(action.date) === dateStr
    );

    if (dateActions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No actions for ${this.selectedDate.toLocaleDateString()}</p>
        </div>
      `;
      return;
    }

    let html = `<div class="date-actions-list">`;

    dateActions.forEach(action => {
      const actionType = this.findActionType(action.action_type_id);
      if (actionType) {
        const value = action.value || 0;
        html += `
          <div class="date-action-item">
            <div class="action-info">
              <span class="action-name">${actionType.name}</span>
              <span class="action-value ${value >= 0 ? 'positive' : 'negative'}">
                ${value >= 0 ? '+' : ''}${formatCurrency(value)}
              </span>
            </div>
            <button class="action-delete-btn" onclick="app.deleteAction(${action.id})" title="Delete action">
              🗑️
            </button>
          </div>
        `;
      }
    });

    html += '</div>';
    container.innerHTML = html;
  }

  changeMonth(direction) {
    if (!this.currentDate) {
      this.currentDate = new Date();
    }
    
    this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    this.renderCalendarGrid();
  }

  async addQuickAction(typeId) {
    const todayStr = getDateString(new Date());
    
    // Prevent double clicks and race conditions
    const button = event.target.closest('button');
    if (button.disabled || button.dataset.processing === 'true') {
      return;
    }
    
    // Check if action already exists for today
    const todayActions = (this.data.actions || []).filter(action => 
      getDateString(new Date(action.date)) === todayStr
    );
    
    const hasActionToday = todayActions.some(action => action.action_type_id === typeId);
    
    if (hasActionToday) {
      // Silently ignore if action already completed today
      return;
    }
    
    // Mark button as processing to prevent duplicate clicks
    button.disabled = true;
    button.dataset.processing = 'true';
    button.style.opacity = '0.6';
    button.innerHTML = button.innerHTML.replace('+', '⏳');
    
    try {
      await this.addAction(typeId, 0, '', todayStr, true); // Pass true for isQuickAction
      
      // Show success state briefly
      button.innerHTML = button.innerHTML.replace('⏳', '✓');
      button.classList.add('completed');
      
    } catch (error) {
      // Reset button on error
      button.innerHTML = button.innerHTML.replace('⏳', '+');
      button.style.opacity = '1';
      button.disabled = false;
      button.dataset.processing = 'false';
      console.error('Quick action failed:', error);
    }
  }

  // Authentication and UI methods
  showAuthUI() {
    const sections = ['dashboard', 'workout', 'calendar', 'profile'];
    sections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) section.style.display = 'none';
    });

    const authSection = document.getElementById('auth') || document.body;
    authSection.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <h1>Welcome to Habitide Tracker</h1>
          <p>Please sign in to continue</p>
          <div class="auth-buttons">
            <button class="btn btn--primary" onclick="app.signInWithGoogle()">Sign in with Google</button>
            <button class="btn btn--secondary" onclick="app.signInWithEmail()">Sign in with Email</button>
          </div>
        </div>
      </div>
    `;
    authSection.style.display = 'block';
  }

  async signInWithGoogle() {
    try {
      this.showLoadingOverlay();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google sign-in error:', error);
      this.hideLoadingOverlay();
      
      if (error.message?.includes('popup')) {
        this.showConfirmationModal(
          'Popup Blocked',
          'Please allow popups for this site and try again, or use email sign-in instead.',
          'warning'
        );
      } else if (error.message?.includes('Network')) {
        this.showConfirmationModal(
          'Connection Error',
          'Unable to connect to Google. Please check your internet connection and try again.',
          'error'
        );
      } else {
        this.showConfirmationModal(
          'Sign-in Failed',
          'Failed to sign in with Google. Please try again or use email sign-in.',
          'error'
        );
      }
    }
  }

  async signInWithEmail() {
    const email = prompt('Enter your email address:');
    if (!email) return;

    // Validate email format
    if (!isValidEmail(email)) {
      this.showConfirmationModal(
        'Invalid Email',
        'Please enter a valid email address.',
        'warning'
      );
      return;
    }

    try {
      this.showLoadingOverlay();
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      this.hideLoadingOverlay();
      
      if (error) throw error;
      
      this.showConfirmationModal(
        'Check Your Email!',
        `We've sent a magic link to ${email}. Click the link in your email to sign in.`,
        'success'
      );
    } catch (error) {
      console.error('Email sign-in error:', error);
      this.hideLoadingOverlay();
      
      if (error.message?.includes('rate limit')) {
        this.showConfirmationModal(
          'Too Many Attempts',
          'Too many sign-in attempts. Please wait a few minutes before trying again.',
          'warning'
        );
      } else if (error.message?.includes('Network')) {
        this.showConfirmationModal(
          'Connection Error',
          'Unable to send email. Please check your internet connection and try again.',
          'error'
        );
      } else {
        this.showConfirmationModal(
          'Email Failed',
          'Failed to send login email. Please check your email address and try again.',
          'error'
        );
      }
    }
  }

  // Data management methods
  async loadData() {
    if (!this.user) return;
    
    try {
      // Load actions
      const { data: actions, error: actionsError } = await supabase
        .from('actions')
        .select('*')
        .eq('user_id', this.user.id)
        .order('date', { ascending: false });

      if (actionsError) throw actionsError;

      // Load settings from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('data')
        .eq('id', this.user.id)
        .single();

      // Extract settings from profile data or use defaults
      let settings = { 
        targetGoal: 20000, 
        reminderTime: '20:00', 
        theme: 'light', 
        quickActions: [1, 2, 3, 4] 
      };

      if (profile && profile.data && profile.data.settings) {
        settings = { ...settings, ...profile.data.settings };
      }

      this.data.actions = actions || [];
      this.data.settings = settings;
      
      // Load custom workouts and workout state from profile data
      if (profile && profile.data) {
        this.data.customWorkouts = profile.data.customWorkouts || {};
        this.data.workoutState = profile.data.workoutState || {};
      } else {
        this.data.customWorkouts = {};
        this.data.workoutState = {};
      }
      this.data.lastFetched = Date.now(); // Update lastFetched after data fetch

    } catch (error) {
      console.error('Failed to load data:', error);
      // Use default data on error
      this.data.actions = [];
      this.data.settings = { 
        targetGoal: 20000, 
        reminderTime: '20:00', 
        theme: 'light', 
        quickActions: [1, 2, 3, 4] 
      };
      this.data.customWorkouts = {};
      this.data.workoutState = {};
      this.data.lastFetched = Date.now(); // Even on error, update lastFetched to avoid infinite fetch loop
    }
  }

  async loadActionTypes() {
    if (!this.user) return;

    try {
      // Load both user's custom action types AND default action types
      const { data: actionTypes, error } = await supabase
        .from('action_types')
        .select('*')
        .or(`user_id.eq.${this.user.id},is_default.eq.true`)
        .order('name');

      if (error) throw error;

      // Remove duplicates by keeping user's version over default
      const uniqueActionTypes = [];
      const seen = new Set();
      
      actionTypes.forEach(type => {
        const key = `${type.name}_${type.category}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueActionTypes.push(type);
        } else if (type.user_id === this.user.id) {
          // Replace default with user's custom version
          const index = uniqueActionTypes.findIndex(t => `${t.name}_${t.category}` === key);
          if (index !== -1) {
            uniqueActionTypes[index] = type;
          }
        }
      });

      // Group by category
      this.data.actionTypes = {
        positive: uniqueActionTypes.filter(type => type.category === 'positive'),
        negative: uniqueActionTypes.filter(type => type.category === 'negative')
      };

    } catch (error) {
      console.error('Failed to load action types:', error);
      // Use default empty arrays
      this.data.actionTypes = { positive: [], negative: [] };
      this.data.lastFetched = Date.now();
    }
  }

  // Use debounced save for performance
  async saveData() {
    this.debouncedSave();
  }
  
  // Actual database save operation
  async saveDataToDatabase() {
    if (!this.user) return;

    try {
      // Get current profile data
      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('data')
        .eq('id', this.user.id)
        .single();

      // Merge all data into profile data
      const profileData = currentProfile?.data || {};
      profileData.settings = this.data.settings;
      profileData.customWorkouts = this.data.customWorkouts;
      profileData.workoutState = this.data.workoutState;

      // Save updated profile
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({
          id: this.user.id,
          data: profileData
        });

      if (saveError) throw saveError;

    } catch (error) {
      console.error('Failed to save data:', error);
      this.showNotification('Failed to save settings', 'error');
    }
  }

  async saveSettings() {
    const targetGoalInput = document.getElementById('targetGoalInput');
    const reminderTimeInput = document.getElementById('reminderTimeInput');
    const themeSelect = document.getElementById('themeSelect');

    if (!targetGoalInput || !reminderTimeInput || !themeSelect) {
      this.showConfirmationModal(
        'Settings Error',
        'Settings form elements not found. Please refresh the page and try again.',
        'error'
      );
      return;
    }

    try {
      // Validate target goal
      const targetGoal = parseInt(targetGoalInput.value);
      if (isNaN(targetGoal) || targetGoal <= 0) {
        this.showConfirmationModal(
          'Invalid Input',
          'Please enter a valid target goal amount (must be a positive number).',
          'warning'
        );
        targetGoalInput.focus();
        return;
      }

      if (targetGoal > 100000000) { // 10 crore limit
        this.showConfirmationModal(
          'Value Too Large',
          'Target goal cannot exceed ₹10,00,00,000. Please enter a smaller amount.',
          'warning'
        );
        targetGoalInput.focus();
        return;
      }

      // Validate reminder time
      const reminderTime = reminderTimeInput.value;
      if (!reminderTime || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(reminderTime)) {
        this.showConfirmationModal(
          'Invalid Time',
          'Please enter a valid reminder time in HH:MM format.',
          'warning'
        );
        reminderTimeInput.focus();
        return;
      }

      // Store previous settings for rollback
      const previousSettings = { ...this.data.settings };

      // Update settings
      this.data.settings = {
        ...this.data.settings,
        targetGoal: targetGoal,
        reminderTime: reminderTime,
        theme: themeSelect.value
      };

      // Apply theme
      this.setTheme(themeSelect.value);

      // Save to database
      await this.saveData();
      
      this.showConfirmationModal(
        'Settings Saved!',
        'Your settings have been successfully updated.',
        'success'
      );

    } catch (error) {
      console.error('Failed to save settings:', error);
      
      // Rollback settings on error
      if (this.data.settings) {
        this.setTheme(this.data.settings.theme);
      }

      if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        this.showConfirmationModal(
          'Connection Error',
          'Unable to save settings due to network issues. Please check your connection and try again.',
          'error'
        );
      } else {
        this.showConfirmationModal(
          'Save Failed',
          'Failed to save settings. Please try again later.',
          'error'
        );
      }
    }
  }

  setTheme(theme) {
    if (!CONFIG.VALID_THEMES.includes(theme)) {
      theme = CONFIG.DEFAULT_THEME;
    }
    
    // Apply theme immediately to prevent flickering
    document.documentElement.setAttribute('data-color-scheme', theme);
    this.data.settings.theme = theme;
    
    // Save to localStorage for immediate retrieval on next load
    localStorage.setItem('habitide-theme', theme);
    
    // Update profile theme dropdown if it exists
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect && themeSelect.value !== theme) {
      themeSelect.value = theme;
    }
  }

  async resetAllData() {
    if (!confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
      return;
    }

    try {
      if (this.user) {
        // Delete all actions
        await supabase
          .from('actions')
          .delete()
          .eq('user_id', this.user.id);

        // Reset settings in profile (preserve action types, only reset user data)
        await supabase
          .from('profiles')
          .upsert({
            id: this.user.id,
            data: {
              settings: {
                targetGoal: 20000,
                reminderTime: '20:00',
                theme: 'light',
                quickActions: [1, 2, 3, 4]
              },
              customWorkouts: {},
              workoutState: {}
            }
          });
      }

      // Store current action types before reset
      const preservedActionTypes = { ...this.data.actionTypes };
      const preservedBadges = [...this.data.badges];

      // Reset local data but preserve action types
      this.data = {
        settings: { targetGoal: 20000, reminderTime: '20:00', theme: 'light', quickActions: [1, 2, 3, 4] },
        actions: [],
        workoutProgress: {},
        customWorkouts: {},
        workoutState: {},
        actionTypes: preservedActionTypes, // Keep action types loaded
        badges: preservedBadges // Keep badges structure
      };

      this.showNotification('All data has been reset', 'success');
      this.renderAll();

    } catch (error) {
      console.error('Failed to reset data:', error);
      this.showNotification('Failed to reset data', 'error');
    }
  }

  invalidateStatsCache() {
    // Clear any cached statistics
    if (this.statsCache) {
      this.statsCache = {};
    }
    if (this.streakCache) {
      this.streakCache = {};
    }
  }

  // Reset render flags for performance optimization
  resetRenderFlags() {
    const sections = ['dashboard', 'workout', 'calendar', 'profile'];
    sections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) delete section.dataset.rendered; // Fix: Remove attribute instead of setting 'false'
    });
    
    const quickActionsContainer = document.getElementById('quickActionsContainer');
    if (quickActionsContainer) delete quickActionsContainer.dataset.rendered; // Fix: Remove attribute
    
    this.eventListenersAttached = false;
  }

  // Action management
  async addAction(typeId, amount = 0, notes = '', dateString = null, isQuickAction = false) {
    const validation = this.validateActionInput(typeId, '', dateString);
    if (!validation.valid) {
      this.showNotification(validation.error, 'error');
      return;
    }

    if (!this.user) {
      this.showNotification('Please sign in to add actions', 'error');
      return;
    }

    // Find the action type to get its value
    const actionType = this.findActionType(typeId);
    if (!actionType) {
      this.showNotification('Action type not found', 'error');
      return;
    }

    try {
      // Normalize the date to ensure consistent format (YYYY-MM-DD) without timezone conversion
      const normalizedDate = validation.dateToUse.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? validation.dateToUse 
        : getDateString(validation.dateToUse);
      
      // First, check if an action already exists for this user, action type, and date
      const { data: existingActions, error: checkError } = await supabase
        .from('actions')
        .select('*')
        .eq('user_id', this.user.id)
        .eq('action_type_id', typeId)
        .eq('date', normalizedDate);

      if (checkError) {
        console.error('Error checking for existing action:', checkError);
        throw checkError;
      }

      const existingAction = existingActions && existingActions.length > 0 ? existingActions[0] : null;

            // Handle duplicate actions
      if (existingAction) {
        if (isQuickAction) {
          // For quick actions, silently ignore duplicates to prevent confusion
          return;
        } else {
          // For manual actions, show confirmation modal
          this.showConfirmationModal(
            'Action Already Exists',
            `You already have a ${actionType.name} action for this date. Would you like to update it instead?`,
            'warning',
            true, // Show action button
            async () => {
              // User confirmed - proceed with update
              await this.performActionUpdate(existingAction, actionType, validation.notes || notes, normalizedDate);
            }
          );
          return; // Exit early - wait for user confirmation
        }
      }

      // No existing action - proceed with normal insertion
      const actionData = {
        user_id: this.user.id,
        action_type_id: typeId,
        date: normalizedDate,
        notes: validation.notes || notes,
        value: actionType.value,
        created_at: new Date().toISOString()
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('actions')
        .insert([actionData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Add to local data
      this.data.actions = this.data.actions || [];
      this.data.actions.unshift(insertedData);

      // Clear the form after successful add
      this.clearActionForm();
      
      // Update UI components
      this.updateUIAfterAction(normalizedDate);

      // REMOVED: No notification for successful additions

    } catch (error) {
      console.error('Failed to add action:', error);
      
      // Enhanced error handling with specific messages
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        // This shouldn't happen with our new logic, but just in case
        this.showNotification('Action already exists for this date and type', 'warning');
      } else if (error.message?.includes('Network')) {
        this.showNotification('Connection error. Please check your internet and try again.', 'error');
      } else {
        this.showNotification('Failed to save action. Please try again.', 'error');
      }
    }
  }

  // Helper method to perform action update
  async performActionUpdate(existingAction, actionType, notes, normalizedDate) {
    try {
      const { data: updatedData, error: updateError } = await supabase
        .from('actions')
        .update({
          notes: notes,
          value: actionType.value,
          created_at: new Date().toISOString()
        })
        .eq('id', existingAction.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update local data
      this.data.actions = this.data.actions || [];
      const localIndex = this.data.actions.findIndex(a => a.id === existingAction.id);
      if (localIndex >= 0) {
        this.data.actions[localIndex] = updatedData;
      }

      // Clear the form after successful update
      this.clearActionForm();
      
      // Update UI components
      this.updateUIAfterAction(normalizedDate);

      // REMOVED: No notification for successful updates

    } catch (error) {
      console.error('Failed to update action:', error);
      this.showNotification('Failed to update action. Please try again.', 'error');
    }
  }

  // Helper method to update UI after action changes
  updateUIAfterAction(normalizedDate) {
    // Use requestAnimationFrame for smoother UI updates
    requestAnimationFrame(() => {
      // Clear render flags to force fresh render
      const quickActionsContainer = document.getElementById('quickActionsContainer');
      if (quickActionsContainer) quickActionsContainer.dataset.rendered = 'false';
      
      // For today's actions, specifically refresh quick actions to show updated state
      const actionDate = new Date(normalizedDate);
      const today = new Date();
      if (actionDate.toDateString() === today.toDateString()) {
        this.renderQuickActions();
      }
      
      this.renderRecentActivities();
      this.updateDashboardStats();
    });
  }

  // Delete action method
  async deleteAction(actionId) {
    if (!confirm('Are you sure you want to delete this action?')) {
      return;
    }

    if (!this.user) {
      this.showNotification('Please sign in to delete actions', 'error');
      return;
    }

    try {
      // Delete from database
      const { error } = await supabase
        .from('actions')
        .delete()
        .eq('id', actionId)
        .eq('user_id', this.user.id); // Security: only delete user's own actions

      if (error) throw error;

      // Remove from local data
      this.data.actions = this.data.actions.filter(action => action.id !== actionId);

      // Update UI
      this.updateSelectedDateActions(); // Refresh calendar sidebar
      this.renderRecentActivities(); // Refresh recent activities
      this.updateDashboardStats(); // Update stats
      
      // If it was today's action, refresh quick actions
      const actionDate = new Date();
      const today = new Date();
      if (actionDate.toDateString() === today.toDateString()) {
        const quickActionsContainer = document.getElementById('quickActionsContainer');
        if (quickActionsContainer) quickActionsContainer.dataset.rendered = 'false';
        this.renderQuickActions();
      }

      // REMOVED: No notification for successful deletions

    } catch (error) {
      console.error('Failed to delete action:', error);
      this.showNotification('Failed to delete action', 'error');
    }
  }

  // Helper method to clear action form
  clearActionForm() {
    const actionNotesElement = document.getElementById('actionNotes');
    const actionTypeElement = document.getElementById('addActionType');
    const actionDateElement = document.getElementById('actionDate');
    const hintElement = document.getElementById('actionTypeHint');
    
    if (actionNotesElement) actionNotesElement.value = '';
    if (actionTypeElement) actionTypeElement.value = '';
    if (actionDateElement) this.setTodayDate(); // Reset to today
    if (hintElement) hintElement.textContent = '';
  }

  // Enhanced confirmation modal with better UX
  showConfirmationModal(title, message, type = 'info', showAction = false, actionCallback = null) {
    // Remove existing modal if any
    const existingModal = document.getElementById('confirmationModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'confirmationModal';
    modal.className = 'modal-overlay';
    
    const iconMap = {
      'success': '✅',
      'error': '❌', 
      'warning': '⚠️',
      'info': 'ℹ️'
    };

    const colorMap = {
      'success': 'var(--color-success)',
      'error': 'var(--color-error)',
      'warning': 'var(--color-warning)',
      'info': 'var(--color-primary)'
    };

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header" style="border-bottom: 2px solid ${colorMap[type]};">
          <div class="modal-title">
            <span class="modal-icon" style="color: ${colorMap[type]};">${iconMap[type]}</span>
            <h3>${title}</h3>
          </div>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          ${showAction ? 
            `<button class="btn btn--outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
             <button class="btn btn--primary" onclick="this.closest('.modal-overlay').remove(); if(${actionCallback}) ${actionCallback}();">Update</button>` :
            `<button class="btn btn--primary" onclick="this.closest('.modal-overlay').remove()">OK</button>`
          }
        </div>
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById('modalStyles')) {
      const styles = document.createElement('style');
      styles.id = 'modalStyles';
      styles.textContent = `
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }
        .modal-content {
          background: var(--color-surface);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          max-width: 400px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          border: 1px solid var(--color-border);
        }
        .modal-header {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .modal-title h3 {
          margin: 0;
          color: var(--color-text);
        }
        .modal-icon {
          font-size: 24px;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--color-text-secondary);
          padding: 4px;
          border-radius: 4px;
        }
        .modal-close:hover {
          background: var(--color-secondary);
        }
        .modal-body {
          padding: 0 20px 20px;
          color: var(--color-text);
          line-height: 1.5;
        }
        .modal-footer {
          padding: 20px;
          border-top: 1px solid var(--color-border);
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .date-action-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          margin: 8px 0;
          background: var(--color-secondary);
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }
        .action-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .action-name {
          font-weight: 500;
          color: var(--color-text);
        }
        .btn--small {
          padding: 6px 8px;
          font-size: 12px;
          min-width: auto;
        }
        .btn--danger {
          background: var(--color-error);
          color: white;
          border: none;
        }
        .btn--danger:hover {
          background: #dc2626;
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(modal);

    // Auto-close for success messages after 3 seconds
    if (type === 'success' && !showAction) {
      setTimeout(() => {
        if (modal.parentNode) {
          modal.remove();
        }
      }, 3000);
    }

    // Store callback for action button
    if (showAction && actionCallback) {
      modal.querySelector('.btn--primary').onclick = () => {
        modal.remove();
        actionCallback();
      };
    }
  }
}

// Initialize app
const app = new HabitideApp();
app.init();
window.app = app;
