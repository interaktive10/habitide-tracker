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
    db: {
      schema: 'public'
    },
    global: {
      headers: { 
        'X-Client-Info': 'habitide-tracker@1.0.0',
        'Cache-Control': 'no-cache'
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
    console.log('HabitideApp: Constructor called');
    
    // Initialize properties
    this.user = null;
    this.data = {
      actions: [],
      settings: { 
        targetGoal: 20000, 
        reminderTime: '20:00', 
        theme: 'light', 
        quickActions: [1, 2, 3, 4] 
      },
      actionTypes: { positive: [], negative: [] },
      customWorkouts: {},
      workoutState: {},
      lastFetched: 0
    };

    // Initialize workout routines (YOUR ACTUAL WORKOUT PLAN)
    this.workoutRoutines = {
      Monday: {
        focus: "Strength Training - Full Body",
        totalTime: "45-60 mins",
        phases: [
          {
            type: "warmup",
            name: "Warm-up",
            duration: "5 mins",
            exercises: [
              { name: "Light cardio", duration: "5 mins" }
            ]
          },
          {
            type: "superset",
            name: "Superset 1",
            exercises: [
              { name: "Squats", sets: 3, reps: "8-12", notes: "Focus on form" },
              { name: "Bench Press", sets: 3, reps: "8-12", notes: "Control the weight" }
            ],
            restTime: "1-2 minutes between supersets"
          },
          {
            type: "single",
            name: "Deadlifts",
            exercises: [
              { name: "Deadlifts", sets: 3, reps: "8-12", notes: "Keep back straight" }
            ],
            restTime: "1-2 minutes between sets"
          },
          {
            type: "superset",
            name: "Superset 2",
            exercises: [
              { name: "Overhead Press", sets: 3, reps: "8-12", notes: "Engage core" },
              { name: "Bent-over Rows", sets: 3, reps: "8-12", notes: "Squeeze shoulder blades" }
            ],
            restTime: "1-2 minutes between supersets"
          },
          {
            type: "single",
            name: "Core Work",
            exercises: [
              { name: "Planks", sets: 3, reps: "30-60 seconds", notes: "Keep straight line" }
            ],
            restTime: "1 minute between sets"
          },
          {
            type: "cooldown",
            name: "Cool-down",
            duration: "5 mins",
            exercises: [
              { name: "Stretching", duration: "5 mins" }
            ]
          }
        ]
      },
      Tuesday: {
        focus: "Cardio - HIIT",
        totalTime: "25-30 mins",
        phases: [
          {
            type: "warmup",
            name: "Warm-up",
            duration: "5 mins",
            exercises: [
              { name: "Light jogging", duration: "5 mins" }
            ]
          },
          {
            type: "hiit",
            name: "HIIT Circuit",
            exercises: [
              { name: "Sprint intervals", sets: 1, reps: "15-20 minutes", notes: "30s sprint, 30s rest - repeat" }
            ],
            restTime: "30 seconds rest between sprints"
          },
          {
            type: "cooldown",
            name: "Cool-down",
            duration: "5 mins",
            exercises: [
              { name: "Walking and stretching", duration: "5 mins" }
            ]
          }
        ]
      },
      Wednesday: {
        focus: "Strength Training - Full Body",
        totalTime: "45-60 mins",
        phases: [
          {
            type: "warmup",
            name: "Warm-up",
            duration: "5 mins",
            exercises: [
              { name: "Light cardio", duration: "5 mins" }
            ]
          },
          {
            type: "superset",
            name: "Superset 1",
            exercises: [
              { name: "Lunges", sets: 3, reps: "10 per leg", notes: "Alternate legs" },
              { name: "Push-ups", sets: 3, reps: "To failure", notes: "Maintain form" }
            ],
            restTime: "1-2 minutes between supersets"
          },
          {
            type: "superset",
            name: "Superset 2",
            exercises: [
              { name: "Pull-ups/Lat Pulldowns", sets: 3, reps: "8-12", notes: "Full range of motion" },
              { name: "Dumbbell Shoulder Press", sets: 3, reps: "8-12", notes: "Control the weight" }
            ],
            restTime: "1-2 minutes between supersets"
          },
          {
            type: "superset",
            name: "Superset 3",
            exercises: [
              { name: "Hip Thrusts", sets: 3, reps: "10-15", notes: "Squeeze glutes at top" },
              { name: "Russian Twists", sets: 3, reps: "15-20", notes: "Keep core engaged" }
            ],
            restTime: "1-2 minutes between supersets"
          },
          {
            type: "cooldown",
            name: "Cool-down",
            duration: "5 mins",
            exercises: [
              { name: "Stretching", duration: "5 mins" }
            ]
          }
        ]
      },
      Thursday: {
        focus: "Cardio - Steady State",
        totalTime: "30-45 mins",
        phases: [
          {
            type: "cardio",
            name: "Moderate-Intensity Cardio",
            duration: "30-45 mins",
            exercises: [
              { name: "Jogging", duration: "30-45 mins", notes: "Moderate pace - can hold conversation" },
              { name: "Cycling", duration: "Alternative option" },
              { name: "Elliptical", duration: "Alternative option" }
            ]
          }
        ]
      },
      Friday: {
        focus: "Strength Training - Full Body",
        totalTime: "45-60 mins",
        phases: [
          {
            type: "warmup",
            name: "Warm-up",
            duration: "5 mins",
            exercises: [
              { name: "Light cardio", duration: "5 mins" }
            ]
          },
          {
            type: "superset",
            name: "Superset 1",
            exercises: [
              { name: "Leg Press", sets: 3, reps: "10-15", notes: "Full range of motion" },
              { name: "Incline Bench Press", sets: 3, reps: "8-12", notes: "Control the weight" }
            ],
            restTime: "1-2 minutes between supersets"
          },
          {
            type: "superset",
            name: "Superset 2",
            exercises: [
              { name: "Seated Rows", sets: 3, reps: "8-12", notes: "Squeeze shoulder blades" },
              { name: "Lateral Raises", sets: 3, reps: "12-15", notes: "Control the movement" }
            ],
            restTime: "1-2 minutes between supersets"
          },
          {
            type: "superset",
            name: "Superset 3",
            exercises: [
              { name: "Leg Raises", sets: 3, reps: "15-20", notes: "Control the movement" },
              { name: "Planks", sets: 3, reps: "30-60 seconds", notes: "Keep straight line" }
            ],
            restTime: "1 minute between supersets"
          },
          {
            type: "cooldown",
            name: "Cool-down",
            duration: "5 mins",
            exercises: [
              { name: "Stretching", duration: "5 mins" }
            ]
          }
        ]
      },
      Saturday: {
        focus: "Football and Running",
        totalTime: "60+ mins",
        phases: [
          {
            type: "activity",
            name: "Football and Steps",
            duration: "60+ mins",
            exercises: [
              { name: "Football game", duration: "60+ mins", notes: "Enjoy the game!" },
              { name: "Aim for ~10,000 steps", duration: "Throughout the day", notes: "Track your steps" }
            ]
          }
        ]
      },
      Sunday: {
        focus: "Rest",
        totalTime: "Optional",
        phases: [
          {
            type: "recovery",
            name: "Optional Light Activity",
            duration: "Optional",
            exercises: [
              { name: "Walking", duration: "Optional", notes: "Light pace for flexibility" },
              { name: "Yoga", duration: "Optional", notes: "Focus on flexibility and relaxation" },
              { name: "Stretching", duration: "Optional", notes: "Gentle stretching" }
            ]
          }
        ]
      }
    };

    // Cache for better performance
    this.cache = new Map();
    this.notificationQueue = [];
    this.renderFlags = { shouldRenderDashboard: true, shouldRenderBadges: true };
    
    // Session expiry: 30 days
    this.SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    
    // Performance optimizations
    this.debouncedSave = PerformanceUtils.debounce(this.saveDataToDatabase.bind(this), CONFIG.SAVE_DEBOUNCE_DELAY);
    this.throttledRender = PerformanceUtils.throttle(this.renderAll.bind(this), CONFIG.RENDER_THROTTLE_DELAY);

    // Initialize theme from system preference if no saved preference
    this.initializeTheme();

    // Don't auto-check auth on visibility change to prevent frequent logouts
    // Removed: document.addEventListener('visibilitychange', this.handleVisibilityChange);
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
    console.log('HabitideApp: Starting initialization');
    
    // Initialize theme first
    this.initializeTheme();
    
    // Check for localStorage session first (for backward compatibility)
    const savedUser = localStorage.getItem('habitide-user');
    if (savedUser) {
      try {
        this.user = JSON.parse(savedUser);
        console.log('HabitideApp: Found localStorage user:', this.user.id);
        await this.postAuthenticationFlow(this.user);
        return;
      } catch (error) {
        console.error('HabitideApp: Error parsing saved user:', error);
        localStorage.removeItem('habitide-user');
      }
    }
    
    // Set up Supabase auth state listener as fallback
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('HabitideApp: Auth state changed:', event, session?.user?.id);
      
      if (session?.user) {
        console.log('HabitideApp: User authenticated via Supabase:', session.user.id);
        this.user = { id: session.user.id, username: session.user.email?.split('@')[0] || 'user' };
        await this.postAuthenticationFlow(session.user);
      } else {
        console.log('HabitideApp: No authenticated user');
        this.showAuthUI();
      }
    });
    
    // Set up visibility change handler
    // Removed auto-check auth on visibility change to prevent frequent logouts
    // document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    console.log('HabitideApp: Initialization complete');
  }

  async postAuthenticationFlow(user) {
    console.log('HabitideApp: Starting post-authentication flow');
    if (!user || !user.id) {
        this.showNotification('User authentication failed. Please sign in again.', 'error');
        this.showAuthUI();
        return;
    }
    
    try {
        this.showLoadingOverlay();
        this.hideAuthUI();
        
        // Get the target section FIRST to set navigation immediately
        const targetSection = localStorage.getItem('habitide-current-section') || 'dashboard';
        console.log('HabitideApp: Target section:', targetSection);
        
        // Set correct navigation state immediately to prevent flash
        this.setNavigationActiveState(targetSection);
        
        // Load all necessary data
        await this.loadData();
        await this.loadActionTypes();
        await this.ensureUserProfile();
        await this.ensureUserHasDefaultActionTypes();
        this.ensureMainSectionsExist();
        this.reAttachEventListeners();
        
        // Navigate to the target section - let navigateToSection handle all rendering
        await this.navigateToSection(targetSection);
        
        console.log('HabitideApp: Post-authentication flow complete');
    } catch (error) {
        console.error('HabitideApp: Post-authentication flow error:', error);
        this.showNotification('Failed to load application data. Please try again.', 'error');
        await this.navigateToSection('dashboard');
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
    
    // Check localStorage for user session
    const savedUser = localStorage.getItem('habitide-user');
    const sessionTimestamp = localStorage.getItem('habitide-session-timestamp');
    
    if (savedUser && sessionTimestamp) {
      const sessionAge = Date.now() - parseInt(sessionTimestamp);
      const sessionExpired = sessionAge > (30 * 24 * 60 * 60 * 1000); // 30 days
      
      if (sessionExpired) {
        console.log("HabitideApp: DEBUG - Session expired, clearing user data");
        localStorage.removeItem('habitide-user');
        localStorage.removeItem('habitide-session-timestamp');
        localStorage.removeItem('habitide-current-section');
        this.user = null;
        return;
      }
      
      try {
        this.user = JSON.parse(savedUser);
        console.log("HabitideApp: DEBUG - User found in localStorage:", this.user);
        
        // Verify user still exists in database
        const { data: userData, error } = await supabase
          .from('users')
          .select('id, username')
          .eq('id', this.user.id)
          .single();
        
        if (error || !userData) {
          console.log("HabitideApp: DEBUG - User not found in database, attempting recovery...");
          
          // Try to recover the user by creating the missing record
          const recoveryResult = await this.recoverMissingUser(this.user);
          if (recoveryResult) {
            console.log("HabitideApp: DEBUG - User recovered successfully");
          } else {
            console.log("HabitideApp: DEBUG - User recovery failed, clearing session");
            this.user = null;
            localStorage.removeItem('habitide-user');
          }
        } else {
          this.user = userData;
          console.log("HabitideApp: DEBUG - User verified in database");
        }
      } catch (error) {
        console.error("HabitideApp: DEBUG - Error parsing saved user:", error);
        this.user = null;
        localStorage.removeItem('habitide-user');
      }
    } else {
      this.user = null;
      console.log("HabitideApp: DEBUG - No user found in localStorage");
    }
    
    console.log("HabitideApp: DEBUG - checkAuth() completed. this.user set to:", this.user ? 'Object' : 'null');
  }

  // New method to recover missing user records
  async recoverMissingUser(userData) {
    try {
      console.log("HabitideApp: DEBUG - Attempting to recover user:", userData.id);
      
      // Create the missing user record
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: userData.id,
          username: userData.username || 'recovered_user',
          password_hash: 'needs_reset', // User will need to reset password
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error("HabitideApp: DEBUG - Failed to recover user:", createError);
        return false;
      }
      
      // Also ensure they have a profile
      await this.ensureUserProfile();
      
      this.user = { id: newUser.id, username: newUser.username };
      this.showNotification('Account recovered successfully. You may need to reset your password.', 'info');
      return true;
      
    } catch (error) {
      console.error("HabitideApp: DEBUG - User recovery error:", error);
      return false;
    }
  }

  // Ensure user has a profile record
  async ensureUserProfile() {
    if (!this.user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', this.user.id)
        .single();
        
      if (error && error.code === 'PGRST116') { // No rows found
        console.log("HabitideApp: DEBUG - Creating missing profile for user:", this.user.id);
        
        await supabase.from('profiles').insert({
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
        
        console.log("HabitideApp: DEBUG - Profile created successfully");
      }
    } catch (error) {
      console.error("HabitideApp: DEBUG - Error ensuring user profile:", error);
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

  setTodayDateForModal() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const modalDateInput = document.getElementById('modalActionDate');
    if (modalDateInput && !modalDateInput.value) {
      modalDateInput.value = `${year}-${month}-${day}`;
      // Set max date to today + 7 days (prevent far future dates)
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 7);
      const maxYear = maxDate.getFullYear();
      const maxMonth = String(maxDate.getMonth() + 1).padStart(2, '0');
      const maxDay = String(maxDate.getDate()).padStart(2, '0');
      modalDateInput.max = `${maxYear}-${maxMonth}-${maxDay}`;
      
      // Set min date to 1 year ago (prevent too old dates)
      const minDate = new Date(today);
      minDate.setFullYear(minDate.getFullYear() - 1);
      const minYear = minDate.getFullYear();
      const minMonth = String(minDate.getMonth() + 1).padStart(2, '0');
      const minDay = String(minDate.getDate()).padStart(2, '0');
      modalDateInput.min = `${minYear}-${minMonth}-${minDay}`;
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

  setNavigationActiveState(sectionName) {
    // Remove active class from all nav links
    const navLinks = document.querySelectorAll('.nav-link, .nav-mobile-link');
    navLinks.forEach(link => link.classList.remove('active'));
    
    // Add active class to corresponding nav link
    const activeNavLink = document.querySelector(`.nav-link[data-section="${sectionName}"], .nav-mobile-link[data-section="${sectionName}"]`);
    if (activeNavLink) {
        activeNavLink.classList.add('active');
    }
  }

  async navigateToSection(sectionName) {
    console.log('HabitideApp: Navigating to section:', sectionName);
    
    // Store current section in localStorage for page refresh persistence
    localStorage.setItem('habitide-current-section', sectionName);
    
    // Ensure main container is visible
    const mainContainer = document.getElementById('main-container');
    if (mainContainer) {
        mainContainer.style.setProperty('display', 'block', 'important');
    }
    
    // Hide all sections first
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    // Show and activate target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.setProperty('display', 'block', 'important');
    } else {
        console.error('HabitideApp: Section not found:', sectionName);
        return;
    }
    
    // Update navigation state
    this.setNavigationActiveState(sectionName);
    
    // Render section content - this is the single place where rendering happens
    try {
        if (sectionName === 'dashboard') {
            await this.renderDashboard();
        } else if (sectionName === 'workout') {
            await this.renderWorkout();
        } else if (sectionName === 'calendar') {
            await this.renderCalendar();
        } else if (sectionName === 'profile') {
            await this.renderProfile();
        }
        console.log('HabitideApp: Navigation to', sectionName, 'complete');
    } catch (error) {
        console.error('HabitideApp: Error rendering section:', sectionName, error);
    }
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
    
    // Navigation links (both desktop and mobile)
    const navLinks = document.querySelectorAll('.nav-link[data-section], .nav-mobile-link[data-section]');
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

    // Add Action Modal Event Listeners
    this.attachModalEventListeners();
  }

  attachModalEventListeners() {
    // Open modal button
    const openModalBtn = document.getElementById('openAddActionModal');
    if (openModalBtn && !openModalBtn.dataset.listenerAttached) {
      openModalBtn.addEventListener('click', () => this.openAddActionModal());
      openModalBtn.dataset.listenerAttached = 'true';
    }

    // Close modal button
    const closeModalBtn = document.getElementById('closeAddActionModal');
    if (closeModalBtn && !closeModalBtn.dataset.listenerAttached) {
      closeModalBtn.addEventListener('click', () => this.closeAddActionModal());
      closeModalBtn.dataset.listenerAttached = 'true';
    }

    // Modal overlay click to close
    const modalOverlay = document.getElementById('addActionModal');
    if (modalOverlay && !modalOverlay.dataset.listenerAttached) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.closeAddActionModal();
        }
      });
      modalOverlay.dataset.listenerAttached = 'true';
    }

    // Modal Add Action button
    const modalAddActionBtn = document.getElementById('modalAddActionBtn');
    if (modalAddActionBtn && !modalAddActionBtn.dataset.listenerAttached) {
      modalAddActionBtn.addEventListener('click', () => {
        const typeIdElement = document.getElementById('modalActionType');
        const notesElement = document.getElementById('modalActionNotes');
        const dateElement = document.getElementById('modalActionDate');
        
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

        // Check if this action already exists for the selected date
        const selectedDateStr = getDateString(new Date(date));
        const actionsForDate = (this.data.actions || []).filter(action => 
          getDateString(new Date(action.date)) === selectedDateStr
        );
        
        const isDuplicate = actionsForDate.some(action => action.action_type_id === parseInt(typeId));
        
        if (isDuplicate) {
          this.showNotification('This action has already been completed for the selected date', 'warning');
          return;
        }
        
        this.addAction(parseInt(typeId), 0, notes, date, false); // Modal form action
        this.closeAddActionModal();
      });
      modalAddActionBtn.dataset.listenerAttached = 'true';
    }

    // Modal Clear button
    const modalClearBtn = document.getElementById('modalClearBtn');
    if (modalClearBtn && !modalClearBtn.dataset.listenerAttached) {
      modalClearBtn.addEventListener('click', () => this.clearModalForm());
      modalClearBtn.dataset.listenerAttached = 'true';
    }

    // Modal action type selection hint
    const modalActionTypeSelect = document.getElementById('modalActionType');
    if (modalActionTypeSelect && !modalActionTypeSelect.dataset.listenerAttached) {
      modalActionTypeSelect.addEventListener('change', (e) => {
        const typeId = parseInt(e.target.value);
        // You can add hint logic here if needed
      });
      modalActionTypeSelect.dataset.listenerAttached = 'true';
    }

    // Modal date change listener to update available actions
    const modalDateInput = document.getElementById('modalActionDate');
    if (modalDateInput && !modalDateInput.dataset.listenerAttached) {
      modalDateInput.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        console.log('Modal date changed to:', selectedDate);
        
        // Re-populate action types for the new date
        this.populateModalActionTypes(selectedDate);
        
        // Clear any selected action type since the list changed
        const typeSelect = document.getElementById('modalActionType');
        if (typeSelect) typeSelect.value = '';
      });
      modalDateInput.dataset.listenerAttached = 'true';
    }

    // Escape key to close modal
    if (!document.body.dataset.modalEscapeAttached) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.getElementById('addActionModal');
          if (modal && modal.classList.contains('active')) {
            this.closeAddActionModal();
          }
        }
      });
      document.body.dataset.modalEscapeAttached = 'true';
    }
  }

  openAddActionModal() {
    const modal = document.getElementById('addActionModal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      
      // Set today's date first
      this.setTodayDateForModal();
      
      // Then populate action types for today's date
      const todayStr = getDateString(new Date());
      this.populateModalActionTypes(todayStr);
      
      // Focus on the first input
      const firstInput = document.getElementById('modalActionDate');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  }

  closeAddActionModal() {
    const modal = document.getElementById('addActionModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = ''; // Restore scrolling
      this.clearModalForm();
    }
  }

  clearModalForm() {
    const typeElement = document.getElementById('modalActionType');
    const notesElement = document.getElementById('modalActionNotes');
    
    if (typeElement) typeElement.value = '';
    if (notesElement) notesElement.value = '';
    
    // Reset to today's date
    this.setTodayDateForModal();
    
    // Refresh dropdown for today's date
    const todayStr = getDateString(new Date());
    this.populateModalActionTypes(todayStr);
  }

  populateModalActionTypes(selectedDate = null) {
    const selectElement = document.getElementById('modalActionType');
    if (!selectElement) return;

    // Get the selected date from the date input if not provided
    if (!selectedDate) {
      const dateElement = document.getElementById('modalActionDate');
      selectedDate = dateElement?.value;
    }

    // Clear existing options except the first one
    selectElement.innerHTML = '<option value="">Choose an action...</option>';

    const actionTypes = [
      ...(this.data.actionTypes?.positive || []),
      ...(this.data.actionTypes?.negative || [])
    ];

    if (!selectedDate || actionTypes.length === 0) {
      // If no date selected or no action types, show empty state
      if (!selectedDate) {
        selectElement.innerHTML = '<option value="">First select a date...</option>';
      }
      return;
    }

    // Get actions for the selected date
    const selectedDateStr = getDateString(new Date(selectedDate));
    const actionsForDate = (this.data.actions || []).filter(action => 
      getDateString(new Date(action.date)) === selectedDateStr
    );
    
    const completedActionTypeIds = new Set(actionsForDate.map(action => action.action_type_id));

    console.log('Modal dropdown debug:', {
      selectedDate,
      selectedDateStr,
      actionsForDate: actionsForDate.length,
      completedActionTypeIds: Array.from(completedActionTypeIds),
      totalActionTypes: actionTypes.length
    });

    let availableCount = 0;
    let completedCount = 0;

    actionTypes.forEach(type => {
      const isCompleted = completedActionTypeIds.has(type.id);
      
      if (isCompleted) {
        // Add completed action as disabled option with visual indicator
        const option = document.createElement('option');
        option.value = type.id;
        option.disabled = true;
        option.textContent = `${type.name} (${type.value > 0 ? '+' : ''}${formatCurrency(type.value)}) ✓ Completed`;
        option.style.color = '#999';
        option.style.fontStyle = 'italic';
        selectElement.appendChild(option);
        completedCount++;
      } else {
        // Add available action as normal option
        const option = document.createElement('option');
        option.value = type.id;
        option.textContent = `${type.name} (${type.value > 0 ? '+' : ''}${formatCurrency(type.value)})`;
        selectElement.appendChild(option);
        availableCount++;
      }
    });

    // Add informational message at the bottom
    if (completedCount > 0) {
      const infoOption = document.createElement('option');
      infoOption.disabled = true;
      infoOption.textContent = `────────────────────────`;
      infoOption.style.color = '#ccc';
      selectElement.appendChild(infoOption);
      
      const summaryOption = document.createElement('option');
      summaryOption.disabled = true;
      summaryOption.textContent = `${availableCount} available, ${completedCount} completed`;
      summaryOption.style.color = '#666';
      summaryOption.style.fontSize = '0.9em';
      selectElement.appendChild(summaryOption);
    }

    console.log(`Modal dropdown populated: ${availableCount} available, ${completedCount} completed`);
  }

  async renderDashboard() {
    console.log('HabitideApp: Rendering dashboard');
    if (!this.user) {
      console.log('HabitideApp: Cannot render dashboard - no user');
      return;
    }

    // Remove loading skeleton if it exists
    const loadingSkeleton = document.querySelector('#dashboard .loading-skeleton');
    if (loadingSkeleton) {
      loadingSkeleton.remove();
    }

    const section = document.getElementById('dashboard');
    if (!section) return;
    
    section.innerHTML = `
      <div class="container">
        <!-- Progress Overview -->
        <div class="dashboard-section card progress-overview">
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
            <div class="goal-progress" style="margin-top: var(--space-32);">
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

        <!-- Add Action Section -->
        <div class="dashboard-section card add-action-section">
          <div class="card__body" style="text-align: center; padding: var(--space-20);">
            <button class="btn btn--primary add-action-modal-btn" id="openAddActionModal">
              <span class="btn-icon">➕</span>
              <span class="btn-text">Add Action</span>
            </button>
          </div>
        </div>

        <!-- Quick Actions - Today -->
        <div class="dashboard-section card quick-actions-card">
          <div class="card__body">
            <h3>Quick Actions - Today</h3>
            <div class="quick-actions-grid" id="quickActionsContainer">
              <!-- Quick actions will be populated here -->
            </div>
          </div>
        </div>

        <!-- Recent Activities -->
        <div class="dashboard-section card activities-card">
          <div class="card__body">
            <h3>Recent Activities</h3>
            <div class="activities-list" id="recentActivities">
              <!-- Recent activities will be populated here -->
            </div>
          </div>
        </div>

        <!-- Achievement Badges -->
        <div class="dashboard-section achievement-badges-section">
          <h2 class="badges-title">Achievement Badges</h2>
          <div class="badges-grid badges-simple" id="badgesContainer">
            <!-- Badges will be populated here -->
          </div>
        </div>
      </div>
      
      <!-- Add Action Modal -->
      <div class="modal-overlay" id="addActionModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Add Action</h3>
            <button class="modal-close" id="closeAddActionModal">×</button>
          </div>
          <div class="modal-body">
            <div class="form-container">
              <div class="form-group">
                <label class="form-label" for="modalActionDate">Select Date</label>
                <input type="date" class="form-control" id="modalActionDate">
              </div>
              <div class="form-group">
                <label class="form-label" for="modalActionType">Action Type</label>
                <select class="form-control" id="modalActionType">
                  <option value="">Choose an action...</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="modalActionNotes">Notes (Optional)</label>
                <input type="text" class="form-control" id="modalActionNotes" placeholder="Add a note...">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" id="modalClearBtn">Clear</button>
            <button class="btn btn--primary" id="modalAddActionBtn">Add Action</button>
          </div>
        </div>
      </div>
    `;

    // Set today's date in the modal date input
    this.setTodayDateForModal();
    
    // Populate dynamic content
    this.updateDashboardStats();
    this.populateActionTypeSelects();
    this.renderQuickActions();
    this.renderRecentActivities();
    this.renderBadges('badgesContainer'); // Explicitly target dashboard badges container
    
    // Attach event listeners after content is ready
    this.reAttachEventListeners();
  }

  renderWorkout() {
    const section = document.getElementById('workout');
    if (!section) return;
    section.innerHTML = `
      <div class="container">
        <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h1>Workout Tracker</h1>
          <button class="btn btn--outline" onclick="app.resetAllWorkouts()" title="Reset all workouts for the week">
            Reset Week
          </button>
        </div>
        <div class="workout-tabs">
          <button class="workout-tab" data-day="Monday">Mon</button>
          <button class="workout-tab" data-day="Tuesday">Tue</button>
          <button class="workout-tab" data-day="Wednesday">Wed</button>
          <button class="workout-tab" data-day="Thursday">Thu</button>
          <button class="workout-tab" data-day="Friday">Fri</button>
          <button class="workout-tab" data-day="Saturday">Sat</button>
          <button class="workout-tab" data-day="Sunday">Sun</button>
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

    // Get default routine and any custom exercises
    const defaultRoutine = this.workoutRoutines[day];
    const customWorkout = this.data.customWorkouts && this.data.customWorkouts[day];
    const routine = defaultRoutine;
    
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
    
    // Add custom exercises to progress calculation
    if (customWorkout && customWorkout.customExercises) {
      customWorkout.customExercises.forEach((exercise, exerciseIndex) => {
        const totalSets = exercise.sets || 1;
        totalItems += totalSets;
        
        const exerciseState = this.data.workoutState[day][`custom_ex_${exerciseIndex}`] || {};
        completedItems += Object.values(exerciseState).filter(completed => completed).length;
      });
    }

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
              ${progressPercentage === 100 ? `
                <button class="btn btn--secondary" onclick="app.resetWorkoutDay('${day}')">
                  Reset Progress
                </button>
              ` : `
                <button class="btn btn--primary" onclick="app.markWorkoutDayComplete('${day}')">
                  ✅ Mark Day Complete
                </button>
              `}
              ${completedItems > 0 && progressPercentage < 100 ? `
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
            
            ${customWorkout && customWorkout.customExercises && customWorkout.customExercises.length > 0 ? `
              <div class="phase-card custom-exercises">
                <div class="phase-header">
                  <div class="phase-info">
                    <h4 class="phase-name">
                      ⭐ Custom Exercises
                    </h4>
                    <span class="phase-rest">Your additional exercises</span>
                  </div>
                </div>
                <div class="phase-exercises">
                  ${customWorkout.customExercises.map((exercise, exerciseIndex) => {
                    const customPhaseKey = `custom_ex_${exerciseIndex}`;
                    const exerciseState = this.data.workoutState[day][customPhaseKey] || {};
                    const exerciseCompletedSets = Object.values(exerciseState).filter(completed => completed).length;
                    const isExerciseComplete = exerciseCompletedSets === exercise.sets;
                    
                    return `
                      <div class="exercise-card ${isExerciseComplete ? 'completed' : ''}">
                        <div class="exercise-header">
                          <div class="exercise-info">
                            <h5 class="exercise-name">${exercise.name} <span style="color: var(--color-primary); font-size: 0.8em;">(Custom)</span></h5>
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
                                       onchange="app.toggleSet('${day}', '${customPhaseKey}', ${setIndex}, this.checked)">
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
            ` : ''}
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

  markWorkoutDayComplete(day) {
    if (confirm(`Mark the entire ${day} workout as complete? This will mark all exercises and sets as done.`)) {
      // Get the default routine and custom workout
      const defaultRoutine = this.workoutRoutines[day];
      const customWorkout = this.data.customWorkouts && this.data.customWorkouts[day];
      
      if (!defaultRoutine || !defaultRoutine.phases) return;
      
      // Initialize workout state if needed
      if (!this.data.workoutState) this.data.workoutState = {};
      if (!this.data.workoutState[day]) this.data.workoutState[day] = {};
      
      // Mark all default phases as complete
      defaultRoutine.phases.forEach((phase, phaseIndex) => {
        const phaseKey = `phase_${phaseIndex}`;
        
        if (phase.type === 'warmup' || phase.type === 'cooldown' || phase.type === 'cardio' || phase.type === 'activity' || phase.type === 'recovery' || phase.type === 'hiit') {
          // For time-based phases, just mark as completed
          this.data.workoutState[day][phaseKey] = { completed: true };
        } else {
          // For set-based phases, mark all sets as complete
          phase.exercises.forEach((exercise, exerciseIndex) => {
            const exerciseKey = `${phaseKey}_ex_${exerciseIndex}`;
            this.data.workoutState[day][exerciseKey] = {};
            
            // Mark all sets as complete
            for (let setIndex = 0; setIndex < exercise.sets; setIndex++) {
              this.data.workoutState[day][exerciseKey][setIndex] = true;
            }
          });
        }
      });
      
      // Mark all custom exercises as complete
      if (customWorkout && customWorkout.customExercises) {
        customWorkout.customExercises.forEach((exercise, exerciseIndex) => {
          const exerciseKey = `custom_ex_${exerciseIndex}`;
          this.data.workoutState[day][exerciseKey] = {};
          
          // Mark all sets as complete
          for (let setIndex = 0; setIndex < exercise.sets; setIndex++) {
            this.data.workoutState[day][exerciseKey][setIndex] = true;
          }
        });
      }
      
      // Save to database
      this.saveData();
      
      // Re-render the workout day
      this.renderWorkoutDay(day);
      
      this.showNotification(`🎉 ${day} workout marked as complete!`, 'success');
    }
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

  checkWeeklyReset() {
    const now = new Date();
    const isSunday = now.getDay() === 0; // Sunday is 0
    const lastReset = this.data.lastWeeklyReset ? new Date(this.data.lastWeeklyReset) : null;
    
    // Check if it's Sunday and we haven't reset this week
    if (isSunday && (!lastReset || this.getWeekStart(now) > this.getWeekStart(lastReset))) {
      this.performWeeklyReset();
    }
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust to Sunday
    return new Date(d.setDate(diff));
  }

  performWeeklyReset() {
    // Reset all workout progress
    this.data.workoutProgress = {};
    this.data.workoutState = {};
    
    // Clear ALL custom workouts for the week
    this.data.customWorkouts = {};
    
    // Update last reset timestamp
    this.data.lastWeeklyReset = new Date().toISOString();
    
    // Save the changes
    this.saveData();
    
    this.showNotification('🔄 Weekly reset completed! All workouts restored to defaults and progress cleared!', 'success');
    console.log('Weekly reset performed - all custom workouts cleared');
  }

  resetAllWorkouts() {
    if (confirm('Reset all workout progress for the entire week? This cannot be undone.')) {
      this.performWeeklyReset();
      this.renderWorkout(); // Re-render all workout days
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
    this.populateCalendarActionTypes(); // Initialize calendar dropdown for selected date
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
              
              <div class="user-zone" style="margin-top: var(--space-24); padding-top: var(--space-24); border-top: 1px solid var(--color-border);">
                <h4 style="margin-bottom: var(--space-16);">Account</h4>
                <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); margin-bottom: var(--space-16);">
                  Signed in as: <strong>${this.user?.username}</strong>
                </p>
                <button class="btn btn--outline" onclick="app.signOut()" style="margin-bottom: var(--space-16);">Sign Out</button>
              </div>
              
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
    this.renderBadges('badgeProgressList'); // Explicitly target profile badges container
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

    // Get ALL exercises - combine default routine with any custom additions
    const customWorkout = this.data.customWorkouts && this.data.customWorkouts[day];
    const defaultRoutine = this.workoutRoutines[day];
    
    let currentExercises = [];
    
    // First, add all exercises from the default routine
    if (defaultRoutine && defaultRoutine.phases) {
      defaultRoutine.phases.forEach(phase => {
        if (phase.exercises) {
          phase.exercises.forEach(exercise => {
            if (exercise.sets && exercise.reps) {
              currentExercises.push({
                name: exercise.name,
                sets: exercise.sets,
                reps: exercise.reps,
                notes: exercise.notes || '',
                source: 'default'
              });
            }
          });
        }
      });
    }
    
    // Then, add any custom exercises (if they exist)
    if (customWorkout && customWorkout.customExercises) {
      customWorkout.customExercises.forEach(exercise => {
        currentExercises.push({
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          notes: exercise.notes || '',
          source: 'custom'
        });
      });
    }

    const exercisesHTML = currentExercises.map((ex, index) => `
      <div class="exercise-item" data-index="${index}" data-source="${ex.source || 'custom'}">
        <div class="exercise-inputs">
          <div class="input-group">
            <label>Exercise Name ${ex.source === 'default' ? '(Default)' : '(Custom)'}</label>
            <input type="text" class="exercise-input" value="${ex.name}" placeholder="e.g., Push-ups" ${ex.source === 'default' ? 'readonly' : ''}>
          </div>
          <div class="input-group">
            <label>Sets</label>
            <input type="number" class="exercise-input" value="${ex.sets || ''}" placeholder="3" min="1" ${ex.source === 'default' ? 'readonly' : ''}>
          </div>
          <div class="input-group">
            <label>Reps</label>
            <input type="text" class="exercise-input" value="${ex.reps || ''}" placeholder="e.g., 10-12" ${ex.source === 'default' ? 'readonly' : ''}>
          </div>
        </div>
        ${ex.source === 'default' ? '' : '<button class="remove-exercise-btn" onclick="this.parentElement.remove()" title="Remove custom exercise"><span>🗑️</span></button>'}
      </div>
    `).join('');

    document.body.insertAdjacentHTML('beforeend', `
      <div class="custom-workout-modal">
        <div class="modal-backdrop" onclick="if(event.target === this) document.querySelector('.custom-workout-modal').remove()"></div>
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
            ${customWorkout ? `<button class="btn btn--secondary" onclick="app.restoreDefaultWorkout('${day}')" style="margin-right: 8px;">Restore Default</button>` : ''}
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
      <div class="exercise-item" data-source="custom">
        <div class="exercise-inputs">
          <div class="input-group">
            <label>Exercise Name (Custom)</label>
            <input type="text" class="exercise-input" placeholder="e.g., Push-ups">
          </div>
          <div class="input-group">
            <label>Sets (optional)</label>
            <input type="number" class="exercise-input" placeholder="3" min="0">
          </div>
          <div class="input-group">
            <label>Reps (optional)</label>
            <input type="text" class="exercise-input" placeholder="e.g., 10-12, or time duration">
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
    const customExercises = [];
    
    // Only save exercises that are marked as 'custom' (not default) OR don't have data-source attribute (new ones)
    container.querySelectorAll('.exercise-item').forEach(item => {
      const dataSource = item.getAttribute('data-source');
      if (dataSource === 'custom' || !dataSource) {
        const inputs = item.querySelectorAll('.exercise-input');
        const name = inputs[0].value.trim();
        const sets = parseInt(inputs[1].value, 10) || 0; // Default to 0 if empty
        const reps = inputs[2].value.trim() || 'As needed'; // Default text if empty
        
        if (name) { // Only name is required now
          customExercises.push({ 
            name, 
            sets: sets || 0, 
            reps: reps || 'As needed', 
            notes: 'Custom exercise' 
          });
        }
      }
    });

    console.log('HabitideApp: Saving custom exercises for', day, 'with', customExercises.length, 'custom exercises');

    if (!this.data.customWorkouts) {
      this.data.customWorkouts = {};
    }

    if (customExercises.length > 0) {
      // Store only the custom exercises, default exercises remain in workoutRoutines
      this.data.customWorkouts[day] = {
        customExercises: customExercises,
        hasCustom: true
      };
      
      console.log('HabitideApp: Custom exercises saved:', this.data.customWorkouts[day]);
      
      // Save to database
      await this.saveData();
      this.showNotification(`Added ${customExercises.length} custom exercise(s) to ${day}!`, 'success');
    } else {
      // Check if there were previously custom exercises to determine the message
      const hadCustom = this.data.customWorkouts && this.data.customWorkouts[day];
      
      if (hadCustom) {
        // Remove custom workout if no custom exercises
        delete this.data.customWorkouts[day];
        await this.saveData();
        this.showNotification('All custom exercises removed.', 'info');
      } else {
        this.showNotification('No custom exercises to save. Please add at least one exercise.', 'warning');
      }
    }
   
    document.querySelector('.custom-workout-modal').remove();
    this.renderWorkoutDay(day);
  }

  restoreDefaultWorkout(day) {
    if (confirm(`Restore the default workout for ${day}? This will replace your current custom workout.`)) {
      // Remove custom workout for this day
      if (this.data.customWorkouts && this.data.customWorkouts[day]) {
        delete this.data.customWorkouts[day];
      }
      
      // Clear workout state for this day to reset progress
      if (this.data.workoutState && this.data.workoutState[day]) {
        delete this.data.workoutState[day];
      }
      
      // Save changes
      this.saveData();
      
      // Close modal and refresh workout display
      document.querySelector('.custom-workout-modal').remove();
      this.renderWorkoutDay(day);
      
      this.showNotification(`${day} workout restored to default!`, 'success');
    }
  }

  // Method to specifically restore Wednesday supersets
  restoreWednesdayDefault() {
    if (confirm('Restore Wednesday to the default superset workout? This will clear any custom workout and progress.')) {
      // Remove custom workout for Wednesday
      if (this.data.customWorkouts && this.data.customWorkouts['Wednesday']) {
        delete this.data.customWorkouts['Wednesday'];
      }
      
      // Clear workout state for Wednesday to reset progress
      if (this.data.workoutState && this.data.workoutState['Wednesday']) {
        delete this.data.workoutState['Wednesday'];
      }
      
      // Save changes
      this.saveData();
      
      // Refresh workout display
      this.renderWorkoutDay('Wednesday');
      
      this.showNotification('Wednesday workout restored to default supersets!', 'success');
      console.log('Wednesday default workout restored:', this.workoutRoutines['Wednesday']);
    }
  }

  // Debug method to check Wednesday workout status
  checkWednesdayWorkout() {
    console.log('=== Wednesday Workout Status ===');
    console.log('Default workout exists:', !!this.workoutRoutines['Wednesday']);
    console.log('Default workout:', this.workoutRoutines['Wednesday']);
    console.log('Custom workout exists:', !!(this.data.customWorkouts && this.data.customWorkouts['Wednesday']));
    console.log('Custom workout:', this.data.customWorkouts && this.data.customWorkouts['Wednesday']);
    console.log('Workout state:', this.data.workoutState && this.data.workoutState['Wednesday']);
    
    const customWorkout = this.data.customWorkouts && this.data.customWorkouts['Wednesday'];
    const routine = customWorkout || this.workoutRoutines['Wednesday'];
    console.log('Current active workout:', routine);
    
    if (this.workoutRoutines['Wednesday']) {
      const supersetCount = this.workoutRoutines['Wednesday'].phases.filter(phase => phase.type === 'superset').length;
      console.log('Default workout superset count:', supersetCount);
    }
    
    return {
      hasDefault: !!this.workoutRoutines['Wednesday'],
      hasCustom: !!(this.data.customWorkouts && this.data.customWorkouts['Wednesday']),
      activeWorkout: routine,
      supersetCount: this.workoutRoutines['Wednesday'] ? 
        this.workoutRoutines['Wednesday'].phases.filter(phase => phase.type === 'superset').length : 0
    };
  }

  async addCalendarAction() {
    const select = document.getElementById('calendarActionType');
    const actionTypeId = parseInt(select.value);
    
    if (!actionTypeId) {
      this.showNotification('Please select an action type', 'error');
      return;
    }

    if (!this.selectedDate) {
      this.showNotification('Please select a date first', 'error');
      return;
    }

    // Use selected date
    const targetDate = this.selectedDate;
    const dateString = getDateString(targetDate);
    
    // Check if this action already exists for the selected date
    const actionsForDate = (this.data.actions || []).filter(action => 
      getDateString(new Date(action.date)) === dateString
    );
    
    const isDuplicate = actionsForDate.some(action => action.action_type_id === actionTypeId);
    
    if (isDuplicate) {
      this.showNotification('This action has already been completed for the selected date', 'warning');
      return;
    }
    
    await this.addAction(actionTypeId, 0, '', dateString, false); // Manual action from calendar
    
    // Refresh calendar and selected date display
    this.renderCalendarGrid(); // Only re-render the grid, not the whole calendar
    this.updateSelectedDateActions();
    this.populateCalendarActionTypes(); // Refresh dropdown to show updated state
    
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
      // Check if user already has action types OR if default types exist
      const { data: existing, error: checkError } = await supabase
        .from('action_types')
        .select('id')
        .or(`user_id.eq.${this.user.id},is_default.eq.true`)
        .limit(1);

      if (checkError) {
        console.error('Error checking existing action types:', checkError);
        return false;
      }

      if (existing && existing.length > 0) {
        console.log('User already has action types or defaults exist, skipping seeding');
        return true;
      }

      // Default actions to seed - 16 total actions
      const defaultActions = [
        // Positive Actions (8 total)
        { name: 'Workout/Exercise', value: 2000, category: 'positive' },
        { name: 'Debt Payment', value: 5000, category: 'positive' },
        { name: 'Healthy Meal', value: 1000, category: 'positive' },
        { name: 'Meditation', value: 2000, category: 'positive' },
        { name: 'Early Sleep', value: 2000, category: 'positive' },
        { name: 'Learning', value: 2000, category: 'positive' },
        { name: 'See sunrise', value: 5000, category: 'positive' },
        { name: 'Reading', value: 2000, category: 'positive' },
        // Negative Actions (8 total)
        { name: 'Junk Food', value: -2000, category: 'negative' },
        { name: 'Skipped Workout', value: -3000, category: 'negative' },
        { name: 'Impulse Purchase', value: -3000, category: 'negative' },
        { name: 'Porn', value: -5000, category: 'negative' },
        { name: 'Procrastination', value: -5000, category: 'negative' },
        { name: 'Miss sunrise', value: -10000, category: 'negative' },
        { name: 'Overtrading', value: -10000, category: 'negative' },
        { name: 'Bad financial decision', value: -10000, category: 'negative' }
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
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressDescription = document.getElementById('progressDescription');

    
    if (targetGoalDisplay) targetGoalDisplay.textContent = format(settings.targetGoal || 0);
    if (currentLevelDisplay) currentLevelDisplay.textContent = format(stats.currentDebt || 0);
    if (totalEarned) totalEarned.textContent = format(stats.totalEarned || 0);
    if (totalLost) totalLost.textContent = format(stats.totalLost || 0);

    // Update progress bar
    const targetGoal = settings.targetGoal || 0;
    const currentDebt = stats.currentDebt || 0;
    let progressPercent = 0;
    let description = '';

    if (targetGoal > 0) {
      const debtReduced = targetGoal - currentDebt;
      progressPercent = Math.max(0, Math.min(100, (debtReduced / targetGoal) * 100));
      
      if (currentDebt <= 0) {
        description = '🎉 Goal achieved! You\'ve eliminated your debt!';
      } else {
        const remaining = format(currentDebt);
        description = `${remaining} remaining to reach your goal`;
      }
    } else {
      description = 'Set a target goal in Profile to track progress';
    }

    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressPercentage) progressPercentage.textContent = `${Math.round(progressPercent)}%`;
    if (progressDescription) progressDescription.textContent = description;
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
    // Only populate generic selects (not calendar which needs date-aware filtering)
    const selects = document.querySelectorAll('#addActionType');
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

  // Separate method for calendar action type population with date filtering
  populateCalendarActionTypes() {
    const selectElement = document.getElementById('calendarActionType');
    if (!selectElement) return;

    // Clear existing options
    selectElement.innerHTML = '<option value="">Add action for this date...</option>';

    // Get selected date
    if (!this.selectedDate) {
      selectElement.innerHTML = '<option value="">Select a date first...</option>';
      return;
    }

    const actionTypesData = this.data.actionTypes || { positive: [], negative: [] };
    const actionTypes = [
      ...(Array.isArray(actionTypesData.positive) ? actionTypesData.positive : []),
      ...(Array.isArray(actionTypesData.negative) ? actionTypesData.negative : [])
    ];

    if (actionTypes.length === 0) {
      selectElement.innerHTML = '<option value="">No action types available</option>';
      return;
    }

    // Get actions for the selected date
    const selectedDateStr = getDateString(this.selectedDate);
    const actionsForDate = (this.data.actions || []).filter(action => 
      getDateString(new Date(action.date)) === selectedDateStr
    );
    
    const completedActionTypeIds = new Set(actionsForDate.map(action => action.action_type_id));

    console.log('Calendar dropdown debug:', {
      selectedDate: this.selectedDate.toDateString(),
      selectedDateStr,
      actionsForDate: actionsForDate.length,
      completedActionTypeIds: Array.from(completedActionTypeIds),
      totalActionTypes: actionTypes.length
    });

    let availableCount = 0;
    let completedCount = 0;

    actionTypes.forEach(type => {
      const isCompleted = completedActionTypeIds.has(type.id);
      
      if (isCompleted) {
        // Add completed action as disabled option with visual indicator
        const option = document.createElement('option');
        option.value = type.id;
        option.disabled = true;
        option.textContent = `${type.name} (${type.value > 0 ? '+' : ''}${formatCurrency(type.value)}) ✓ Completed`;
        option.style.color = '#999';
        option.style.fontStyle = 'italic';
        selectElement.appendChild(option);
        completedCount++;
      } else {
        // Add available action as normal option
        const option = document.createElement('option');
        option.value = type.id;
        option.textContent = `${type.name} (${type.value > 0 ? '+' : ''}${formatCurrency(type.value)})`;
        selectElement.appendChild(option);
        availableCount++;
      }
    });

    // Add informational message at the bottom
    if (completedCount > 0) {
      const infoOption = document.createElement('option');
      infoOption.disabled = true;
      infoOption.textContent = `────────────────────────`;
      infoOption.style.color = '#ccc';
      selectElement.appendChild(infoOption);
      
      const summaryOption = document.createElement('option');
      summaryOption.disabled = true;
      summaryOption.textContent = `${availableCount} available, ${completedCount} completed`;
      summaryOption.style.color = '#666';
      summaryOption.style.fontSize = '0.9em';
      selectElement.appendChild(summaryOption);
    }

    console.log(`Calendar dropdown populated: ${availableCount} available, ${completedCount} completed`);
  }

  renderQuickActions() {
    const container = document.getElementById('quickActionsContainer');
    if (!container) return;
    
    console.log('renderQuickActions called - rendered flag:', container.dataset.rendered);
    console.log('Quick Actions Debug: this.data.actionTypes:', this.data.actionTypes);
    console.log('Quick Actions Debug: this.data.settings:', this.data.settings);
    
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
    
    console.log('Quick Actions Debug:', {
      todayStr,
      totalActions: this.data.actions?.length || 0,
      todayActionsCount: todayActions.length,
      todayActionTypes: todayActions.map(a => a.action_type_id),
      selectedActionTypes: selectedActionTypes.map(t => ({ id: t.id, name: t.name }))
    });
    
    let html = '';
    
    selectedActionTypes.forEach(type => {
      const hasActionToday = todayActions.some(action => action.action_type_id === type.id);
      console.log(`Action type ${type.name} (ID: ${type.id}): ${hasActionToday ? 'COMPLETED' : 'AVAILABLE'} today`);
      
      if (hasActionToday) {
        // Completed action - no click handler, styled as completed
        html += `
          <div class="action-button completed" 
               style="pointer-events: none; opacity: 0.7; cursor: not-allowed;"
               title="Completed today ✓">
            <div class="action-name">${type.name}</div>
            <div class="action-value ${type.value >= 0 ? 'positive' : 'negative'}">
              ${type.value >= 0 ? '+' : ''}${formatCurrency(type.value)}
            </div>
            <div class="action-button-icon">✓</div>
            <div class="completed-overlay">Completed Today</div>
          </div>
        `;
      } else {
        // Active action - with click handler
        html += `
          <button class="action-button" 
                  data-action-id="${type.id}"
                  title="Click to mark as completed today">
            <div class="action-name">${type.name}</div>
            <div class="action-value ${type.value >= 0 ? 'positive' : 'negative'}">
              ${type.value >= 0 ? '+' : ''}${formatCurrency(type.value)}
            </div>
            <div class="action-button-icon">+</div>
          </button>
        `;
      }
    });
    
    container.innerHTML = html;
    container.dataset.rendered = 'true';
    
    // Add event delegation for quick action buttons
    container.removeEventListener('click', this.handleQuickActionClick);
    container.addEventListener('click', this.handleQuickActionClick.bind(this));
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

  // Handle quick action button clicks with event delegation
  handleQuickActionClick(event) {
    const button = event.target.closest('.action-button[data-action-id]');
    if (button && !button.classList.contains('completed')) {
      const actionId = parseInt(button.dataset.actionId);
      this.addQuickAction(actionId);
    }
  }

  renderBadges(targetContainer = null) {
    // Use specified container or try to find appropriate one based on current section
    let container = null;
    
    if (targetContainer) {
      container = document.getElementById(targetContainer);
    } else {
      // Determine context by checking current active section
      const activeSection = document.querySelector('.section.active');
      const currentSection = activeSection ? activeSection.id : 'dashboard';
      
      if (currentSection === 'profile') {
        container = document.getElementById('badgeProgressList');
      } else {
        container = document.getElementById('badgesContainer');
      }
      
      // Fallback to any available container
      if (!container) {
        container = document.getElementById('badgeProgressList') || 
                   document.getElementById('badgesContainer') ||
                   document.querySelector('.badges-grid');
      }
    }
    
    if (!container) {
      console.log('Badge container not found');
      return;
    }
    
    // Ensure badges are initialized
    if (!this.data.badges || this.data.badges.length === 0) {
      console.log('Initializing default badges...');
      this.data.badges = [
        // Milestone badges
        { id: 1, name: "First Step", icon: "🎯", type: "milestone", requirement: 1, description: "Complete your first action", earned: false, color: "#10B981" },
        
        // Streak badges
        { id: 2, name: "Week Warrior", icon: "🔥", type: "streak", requirement: 7, description: "7-day streak", earned: false, color: "#F59E0B" },
        { id: 3, name: "Month Master", icon: "💎", type: "streak", requirement: 30, description: "30-day streak", earned: false, color: "#3B82F6" },
        { id: 4, name: "Hundred Hero", icon: "👑", type: "streak", requirement: 100, description: "100-day streak", earned: false, color: "#8B5CF6" },
        
        // Savings badges (debt reduction)
        { id: 5, name: "Quarter Crusher", icon: "⭐", type: "savings", requirement: 0.25, description: "Reduce debt by 25%", earned: false, color: "#06B6D4" },
        { id: 6, name: "Half Hero", icon: "🌟", type: "savings", requirement: 0.5, description: "Reduce debt by 50%", earned: false, color: "#84CC16" },
        { id: 7, name: "Debt Destroyer", icon: "💰", type: "savings", requirement: 1.0, description: "Eliminate all debt", earned: false, color: "#F97316" },
        
        // Action count badges
        { id: 8, name: "Action Hero", icon: "💪", type: "actions", requirement: 50, description: "Complete 50 positive actions", earned: false, color: "#EF4444" },
        { id: 9, name: "Century Club", icon: "🏆", type: "actions", requirement: 100, description: "Complete 100 positive actions", earned: false, color: "#EC4899" },
        { id: 10, name: "Thousand Strong", icon: "🎖️", type: "actions", requirement: 1000, description: "Complete 1000 positive actions", earned: false, color: "#6366F1" }
      ];
    }
    
    // Calculate badge progress dynamically
    this.calculateBadgeProgress();
    
    console.log('Rendering badges:', this.data.badges.length, 'badges found');

    let html = '';
    
    // Check if we're rendering in profile section (detailed view) or dashboard (compact view)
    const isProfileSection = container.id === 'badgeProgressList';
    
    this.data.badges.forEach(badge => {
      const progress = this.getBadgeProgress(badge);
      const percentage = Math.min((progress / badge.requirement) * 100, 100);
      const isEarned = badge.earned || progress >= badge.requirement;
      const isInProgress = progress > 0 && !isEarned;
      const badgeColor = badge.color || '#6B7280';
      
      if (isProfileSection) {
        // Detailed view for profile section - enhanced design
        html += `
          <div class="badge-progress-item ${isEarned ? 'earned' : isInProgress ? 'in-progress' : 'locked'}" 
               style="--badge-color: ${badgeColor}">
            <div class="badge-progress-main">
              <div class="badge-progress-icon-container">
                <div class="badge-progress-icon ${isEarned ? 'earned' : isInProgress ? 'in-progress' : 'locked'}">
                  <span class="badge-icon-emoji">${badge.icon}</span>
                  ${isEarned ? '<div class="badge-earned-overlay">✨</div>' : ''}
                </div>
                <div class="badge-progress-ring">
                  <svg width="60" height="60" class="progress-ring">
                    <circle cx="30" cy="30" r="25" stroke="var(--color-border)" stroke-width="3" fill="none" />
                    <circle cx="30" cy="30" r="25" stroke="${badgeColor}" stroke-width="3" fill="none"
                            stroke-dasharray="${2 * Math.PI * 25}" 
                            stroke-dashoffset="${2 * Math.PI * 25 * (1 - percentage / 100)}"
                            class="progress-circle ${isEarned ? 'completed' : ''}" />
                  </svg>
                </div>
              </div>
              <div class="badge-progress-details">
                <div class="badge-progress-header">
                  <h4 class="badge-progress-name">${badge.name}</h4>
                  ${isEarned ? '<span class="badge-earned-status">✅ Earned!</span>' : ''}
                </div>
                <p class="badge-progress-description">${badge.description}</p>
                <div class="badge-progress-stats">
                  <span class="badge-progress-text">${this.formatBadgeProgressEnhanced(badge, progress)}</span>
                  <span class="badge-progress-percentage">${Math.round(percentage)}%</span>
                </div>
                <div class="badge-progress-bar">
                  <div class="badge-progress-bar-fill" style="width: ${percentage}%; background-color: ${badgeColor}"></div>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        // Compact view for dashboard - enhanced grid design
        html += `
          <div class="badge-item ${isEarned ? 'earned' : isInProgress ? 'in-progress' : 'locked'}" 
               style="--badge-color: ${badgeColor}"
               title="${badge.description}">
            <div class="badge-circle-container">
              <div class="badge-circle ${isEarned ? 'earned' : isInProgress ? 'in-progress' : 'locked'}">
                <div class="badge-icon">${badge.icon}</div>
                ${isEarned ? '<div class="badge-earned-glow"></div>' : ''}
              </div>
              <div class="badge-progress-ring-small">
                <svg width="50" height="50" class="progress-ring-small">
                  <circle cx="25" cy="25" r="20" stroke="var(--color-border)" stroke-width="2" fill="none" />
                  <circle cx="25" cy="25" r="20" stroke="${badgeColor}" stroke-width="2" fill="none"
                          stroke-dasharray="${2 * Math.PI * 20}" 
                          stroke-dashoffset="${2 * Math.PI * 20 * (1 - percentage / 100)}"
                          class="progress-circle-small ${isEarned ? 'completed' : ''}" />
                </svg>
              </div>
            </div>
            <div class="badge-info">
              <div class="badge-name">${badge.name}</div>
              <div class="badge-progress-text">${this.formatBadgeProgressCompact(badge, progress)}</div>
            </div>
          </div>
        `;
      }
    });
    
    if (html === '') {
      html = '<div class="empty-state">No badges available</div>';
    }
    container.innerHTML = html;
    console.log('Badges rendered successfully:', this.data.badges.length, 'badges in', container.id || 'unknown container');
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

  // Helper method to format badge progress text (legacy - keeping for compatibility)
  formatBadgeProgress(badge, progress) {
    return this.formatBadgeProgressCompact(badge, progress);
  }

  // Enhanced progress formatting for detailed view
  formatBadgeProgressEnhanced(badge, progress) {
    switch (badge.type) {
      case 'milestone':
        return progress >= badge.requirement ? '🎉 Milestone achieved!' : 'Complete your first action to unlock';
        
      case 'streak':
        if (progress >= badge.requirement) {
          return `🔥 ${Math.floor(progress)} day streak achieved!`;
        } else if (progress > 0) {
          return `Current streak: ${Math.floor(progress)} days (${badge.requirement - Math.floor(progress)} more to go)`;
        } else {
          return `Start a ${badge.requirement}-day streak`;
        }
        
      case 'savings':
        const currentPercentage = Math.min((progress / badge.requirement) * 100, 100);
        const targetPercentage = badge.requirement * 100;
        if (currentPercentage >= targetPercentage) {
          return `💰 ${targetPercentage}% debt reduction achieved!`;
        } else {
          return `${currentPercentage.toFixed(1)}% debt reduced (targeting ${targetPercentage}%)`;
        }
        
      case 'actions':
        if (progress >= badge.requirement) {
          return `💪 ${Math.floor(progress)} positive actions completed!`;
        } else {
          return `${Math.floor(progress)} of ${badge.requirement} positive actions completed`;
        }
        
      default:
        return `${Math.floor(progress)} of ${badge.requirement} completed`;
    }
  }

  // Compact progress formatting for grid view
  formatBadgeProgressCompact(badge, progress) {
    switch (badge.type) {
      case 'milestone':
        return progress >= badge.requirement ? 'Complete!' : '0/1';
        
      case 'streak':
        return `${Math.floor(progress)}/${badge.requirement} days`;
        
      case 'savings':
        const percentage = Math.min((progress / badge.requirement) * 100, 100);
        const target = badge.requirement * 100;
        return `${percentage.toFixed(0)}%/${target}%`;
        
      case 'actions':
        return `${Math.floor(progress)}/${badge.requirement}`;
        
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
    this.populateCalendarActionTypes(); // Update dropdown for the new selected date
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
    
    // Check if action already exists for today FIRST
    const todayActions = (this.data.actions || []).filter(action => 
      getDateString(new Date(action.date)) === todayStr
    );
    
    const hasActionToday = todayActions.some(action => action.action_type_id === typeId);
    
    if (hasActionToday) {
      // Action already completed today - should not happen if UI is correct
      console.log('Action already completed today for type:', typeId);
      this.forceReRenderQuickActions(); // Force refresh UI to show correct state
      return;
    }
    
    // Get the button element for visual feedback
    const button = document.querySelector(`[data-action-id="${typeId}"]`);
    if (button && (button.disabled || button.dataset.processing === 'true')) {
      return; // Prevent double clicks
    }
    
    // Mark button as processing to prevent duplicate clicks
    if (button) {
      button.disabled = true;
      button.dataset.processing = 'true';
      button.style.opacity = '0.6';
      const iconElement = button.querySelector('.action-button-icon');
      if (iconElement) iconElement.textContent = '⏳';
    }
    
    try {
      await this.addAction(typeId, 0, '', todayStr, true); // Pass true for isQuickAction
      
      // Force immediate re-render to show the correct state
      this.forceReRenderQuickActions();
      
    } catch (error) {
      // Reset button on error
      if (button) {
        button.style.opacity = '1';
        button.disabled = false;
        button.dataset.processing = 'false';
        const iconElement = button.querySelector('.action-button-icon');
        if (iconElement) iconElement.textContent = '+';
      }
      console.error('Quick action failed:', error);
    }
  }

  // Force re-render of quick actions by clearing the rendered flag
  forceReRenderQuickActions() {
    const container = document.getElementById('quickActionsContainer');
    if (container) {
      container.dataset.rendered = 'false';
      this.renderQuickActions();
    }
  }

  // Authentication and UI methods
  hideAuthUI() {
    const authSection = document.getElementById('auth');
    if (authSection) {
      authSection.style.display = 'none';
      console.log('HabitideApp: Auth section hidden successfully');
    } else {
      console.error('HabitideApp: Auth section not found');
    }

    const mainContainer = document.getElementById('main-container') || document.querySelector('.app-container') || document.querySelector('main');
    if (mainContainer) {
      mainContainer.style.setProperty('display', 'block', 'important');
      console.log('HabitideApp: Main container found and styled:', mainContainer.id || mainContainer.className);
    } else {
      console.error('HabitideApp: Main container not found');
    }

    const sections = ['dashboard', 'workout', 'calendar', 'profile'];
    sections.forEach(id => {
      const section = document.getElementById(id);
      if (section) {
        section.style.display = '';
      }
    });

    const navTop = document.querySelector('.nav-top');
    if (navTop) navTop.style.display = 'block';
    
    const navMobile = document.querySelector('.nav-mobile');
    const mobileHeader = document.querySelector('.mobile-header');
    
    if (navMobile) navMobile.style.display = '';
    if (mobileHeader) mobileHeader.style.display = '';
    
    document.body.style.overflow = '';
    document.body.classList.remove('auth-mode');
    document.body.classList.add('app-mode');
    
    // Add debug CSS to ensure section visibility
    const debugStyle = document.createElement('style');
    debugStyle.id = 'debug-section-visibility';
    debugStyle.textContent = `
      body.app-mode .app-container,
      body.app-mode #main-container {
        display: block !important;
      }
      body.auth-mode .app-container,
      body.auth-mode #main-container {
        display: none !important;
      }
      .section.active {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .section:not(.active) {
        display: none !important;
      }
      #main-container {
        display: block !important;
      }
    `;
    
    // Remove existing debug style if present to avoid duplicates
    const existingDebugStyle = document.getElementById('debug-section-visibility');
    if (existingDebugStyle) {
      existingDebugStyle.remove();
    }
    
    document.head.appendChild(debugStyle);
    
    console.log('HabitideApp: Auth UI hidden, main UI shown');
  }

  showAuthUI() {
    // Hide main app container
    const mainContainer = document.getElementById('main-container') || document.querySelector('.app-container') || document.querySelector('main');
    if (mainContainer) {
      mainContainer.style.display = 'none';
    }

    // Hide main sections
    const sections = ['dashboard', 'workout', 'calendar', 'profile'];
    sections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) section.style.display = 'none';
    });

    // Hide navigation
    const navTop = document.querySelector('.nav-top');
    const navMobile = document.querySelector('.nav-mobile');
    const mobileHeader = document.querySelector('.mobile-header');
    
    if (navTop) navTop.style.display = 'none';
    if (navMobile) navMobile.style.display = 'none';
    if (mobileHeader) mobileHeader.style.display = 'none';

    // Set body to auth mode
    document.body.classList.remove('app-mode');
    document.body.classList.add('auth-mode');

    const authSection = document.getElementById('auth') || document.body;
    authSection.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <h1>Welcome to Habitide Tracker</h1>
          <p>Please sign in or create an account to continue</p>
          
          <div class="auth-tabs">
            <button class="auth-tab active" data-tab="signin">Sign In</button>
            <button class="auth-tab" data-tab="signup">Sign Up</button>
          </div>

          <!-- Sign In Form -->
          <div class="auth-form active" id="signin-form">
            <div class="form-group">
              <label class="form-label" for="signin-username">Username</label>
              <input type="text" class="form-control" id="signin-username" placeholder="Enter your username" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="signin-password">Password</label>
              <input type="password" class="form-control" id="signin-password" placeholder="Enter your password" required>
            </div>
            <button class="btn btn--primary btn--full-width" onclick="app.signIn()">Sign In</button>
            <div class="auth-error" id="signin-error"></div>
          </div>

          <!-- Sign Up Form -->
          <div class="auth-form" id="signup-form">
            <div class="form-group">
              <label class="form-label" for="signup-username">Username</label>
              <input type="text" class="form-control" id="signup-username" placeholder="Choose a username" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="signup-password">Password</label>
              <input type="password" class="form-control" id="signup-password" placeholder="Choose a password (min 6 characters)" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="signup-password-confirm">Confirm Password</label>
              <input type="password" class="form-control" id="signup-password-confirm" placeholder="Confirm your password" required>
            </div>
            <button class="btn btn--primary btn--full-width" onclick="app.signUp()">Sign Up</button>
            <div class="auth-error" id="signup-error"></div>
          </div>
        </div>
      </div>
    `;
    authSection.style.display = 'block';
    
    // Add tab switching functionality
    const authTabs = authSection.querySelectorAll('.auth-tab');
    const authForms = authSection.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Update active tab
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active form
        authForms.forEach(form => form.classList.remove('active'));
        authSection.querySelector(`#${targetTab}-form`).classList.add('active');
      });
    });
    
    // Add Enter key functionality for forms
    const addEnterKeyListener = (formId, buttonCallback) => {
      const form = authSection.querySelector(`#${formId}`);
      if (form) {
        form.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            buttonCallback();
          }
        });
      }
    };
    
    addEnterKeyListener('signin-form', () => this.signIn());
    addEnterKeyListener('signup-form', () => this.signUp());
  }

  async signUp() {
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;
    const errorElement = document.getElementById('signup-error');
    
    // Clear previous errors
    errorElement.textContent = '';
    
    // Validation
    if (!username || !password || !passwordConfirm) {
      errorElement.textContent = 'Please fill in all fields';
      return;
    }
    
    if (username.length < 3) {
      errorElement.textContent = 'Username must be at least 3 characters long';
      return;
    }
    
    if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
      errorElement.textContent = `Password must be at least ${CONFIG.MIN_PASSWORD_LENGTH} characters long`;
      return;
    }
    
    if (password !== passwordConfirm) {
      errorElement.textContent = 'Passwords do not match';
      return;
    }
    
    try {
      this.showLoadingOverlay();
      
      // Check if username already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();
      
      if (existingUser) {
        errorElement.textContent = 'Username already exists. Please choose a different one.';
        this.hideLoadingOverlay();
        return;
      }
      
      // Create new user with basic hashing (in real app you'd use better hashing)
      const hashedPassword = btoa(password); // Simple base64 encoding (not secure for production)
      
      // Generate UUID for user (to match database schema)
      const userId = crypto.randomUUID();
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          username: username,
          password_hash: hashedPassword,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      this.user = { id: newUser.id, username: newUser.username };
      localStorage.setItem('habitide-user', JSON.stringify(this.user));
      localStorage.setItem('habitide-session-timestamp', Date.now().toString());
      
      await this.ensureUserHasDefaultActionTypes();
      
      // Pass user to postAuthenticationFlow
      await this.postAuthenticationFlow(this.user);
      this.showNotification('Account created successfully!', 'success');
      
    } catch (error) {
      console.error('Sign-up error:', error);
      this.hideLoadingOverlay();
      errorElement.textContent = 'Failed to create account. Please try again.';
      requestAnimationFrame(() => {
        this.hideAuthUI();
        this.navigateToSection('dashboard');
      });
    }
  }

  async signIn() {
    const username = document.getElementById('signin-username').value.trim();
    const password = document.getElementById('signin-password').value;
    const errorElement = document.getElementById('signin-error');
    
    // Clear previous errors
    errorElement.textContent = '';
    
    if (!username || !password) {
      errorElement.textContent = 'Please enter both username and password';
      return;
    }
    
    try {
      this.showLoadingOverlay();
      
      // Find user by username
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (userError || !userData) {
        errorElement.textContent = 'Invalid username or password';
        this.hideLoadingOverlay();
        return;
      }
      
      // Verify password (simple base64 check - not secure for production)
      const hashedPassword = btoa(password);
      if (userData.password_hash !== hashedPassword) {
        errorElement.textContent = 'Invalid username or password';
        this.hideLoadingOverlay();
        return;
      }
      
      this.user = { id: userData.id, username: userData.username };
      localStorage.setItem('habitide-user', JSON.stringify(this.user));
      localStorage.setItem('habitide-session-timestamp', Date.now().toString());
      
      console.log('HabitideApp: USER SET TO:', this.user);
      
      // Rely on postAuthenticationFlow for navigation
      await this.postAuthenticationFlow(this.user);
      this.showNotification('Signed in successfully!', 'success');
      
    } catch (error) {
      console.error('Sign-in error:', error);
      this.hideLoadingOverlay();
      errorElement.textContent = 'Failed to sign in. Please try again.';
      requestAnimationFrame(() => {
        this.hideAuthUI();
        this.navigateToSection('dashboard');
      });
    }
  }

  signOut() {
    // Clear local data immediately
    this.user = null;
    localStorage.removeItem('habitide-user');
    localStorage.removeItem('habitide-session-timestamp'); // Clear session timestamp
    localStorage.removeItem('habitide-current-section'); // Clear navigation state
    
    // Sign out from Supabase silently (don't wait for it)
    supabase.auth.signOut().catch(error => {
      console.log('Supabase signout error (ignored):', error);
    });
    
    this.showAuthUI();
    this.showNotification('Signed out successfully', 'info');
  }

  // Data management methods
  async loadData() {
    console.log('HabitideApp: Starting loadData');
    if (!this.user) {
      console.log("HabitideApp: NO USER SET - Cannot load data");
      return;
    }
    
    try {
      console.log("HabitideApp: Loading data for user:", this.user.id);
      console.log("HabitideApp: User object:", this.user);
      
      // Load actions
      const { data: actions, error: actionsError } = await supabase
        .from('actions')
        .select('*')
        .eq('user_id', this.user.id)
        .order('date', { ascending: false });

      if (actionsError) {
        console.error("HabitideApp: Actions query error:", actionsError);
        throw actionsError;
      }
      
      console.log("HabitideApp: Actions loaded:", actions?.length || 0, "actions found");

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
      console.log('HabitideApp: loadData complete');

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
      
      // Show specific error information
      if (error.message?.includes('406')) {
        this.showNotification('Profile data access blocked - please check database setup', 'error');
      } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        this.showNotification('Database tables missing - please run setup script', 'error');
      } else {
        this.showNotification('Failed to load profile data - using defaults', 'warning');
      }
    }
  }

  async loadActionTypes() {
    if (!this.user) {
      console.log("HabitideApp: NO USER SET - Cannot load action types");
      return;
    }

    try {
      console.log("HabitideApp: Loading action types for user:", this.user.id);
      
      // Load both user's custom action types AND default action types
      const { data: actionTypes, error } = await supabase
        .from('action_types')
        .select('*')
        .or(`user_id.eq.${this.user.id},user_id.is.null`)
        .order('name');

      if (error) {
        console.error("HabitideApp: Action types query error:", error);
        throw error;
      }

      console.log("HabitideApp: Action types loaded:", actionTypes?.length || 0);
      console.log("HabitideApp: Raw action types:", actionTypes);

      // Remove duplicates by keeping user's version over default
      const uniqueActionTypes = [];
      const seen = new Set();
      
      (actionTypes || []).forEach(type => {
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

      console.log("HabitideApp: Action types grouped - Positive:", this.data.actionTypes.positive.length, "Negative:", this.data.actionTypes.negative.length);
      console.log("HabitideApp: Positive action types:", this.data.actionTypes.positive);
      console.log("HabitideApp: Negative action types:", this.data.actionTypes.negative);
      console.log('HabitideApp: loadActionTypes complete');

    } catch (error) {
      console.error('Failed to load action types:', error);
      // Use default empty arrays
      this.data.actionTypes = { positive: [], negative: [] };
      this.data.lastFetched = Date.now();
      
      this.showNotification('Failed to load action types', 'warning');
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
      // For today's actions, force refresh quick actions to show updated state
      const actionDate = new Date(normalizedDate);
      const today = new Date();
      if (actionDate.toDateString() === today.toDateString()) {
        this.forceReRenderQuickActions();
      }
      
      this.renderRecentActivities();
      this.updateDashboardStats();
      
      // Re-render badges in correct context
      const activeSection = document.querySelector('.section.active');
      const currentSection = activeSection ? activeSection.id : 'dashboard';
      if (currentSection === 'profile') {
        this.renderBadges('badgeProgressList');
      } else {
        this.renderBadges('badgesContainer');
      }

      // If modal is open, refresh its dropdown to reflect the new action
      const modal = document.getElementById('addActionModal');
      if (modal && modal.classList.contains('active')) {
        const dateInput = document.getElementById('modalActionDate');
        if (dateInput && dateInput.value) {
          this.populateModalActionTypes(dateInput.value);
          // Clear selected action type since list changed
          const typeSelect = document.getElementById('modalActionType');
          if (typeSelect) typeSelect.value = '';
        }
      }

      // If calendar page is active, refresh its dropdown too
      const currentActiveSection = document.querySelector('.section.active');
      if (currentActiveSection && currentActiveSection.id === 'calendar') {
        this.populateCalendarActionTypes();
        // Clear selected action type since list changed
        const calendarTypeSelect = document.getElementById('calendarActionType');
        if (calendarTypeSelect) calendarTypeSelect.value = '';
      }
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

// Initialize app after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new HabitideApp();
  app.init();
  window.app = app;
});
