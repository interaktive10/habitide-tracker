import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Utility functions
const formatCurrency = (amount) => `₹${Math.abs(amount).toLocaleString('en-IN')}`;
const getDateString = (date) => date.toISOString().split('T')[0];

// Main app class
class HabitideApp {
  constructor() {
    this.user = null;
    this.data = {
      settings: { targetGoal: 20000, reminderTime: '20:00', theme: 'light', quickActions: [1, 2, 9, 10] },
      actions: [],
      workoutProgress: {},
      customWorkouts: {},
      actionTypes: { positive: [], negative: [] },
      badges: [
        { id: 1, name: "First Step", description: "Complete your first action", type: "milestone", requirement: 1, icon: "🎯", earned: false },
        { id: 2, name: "Week Warrior", description: "Maintain a 7-day streak", type: "streak", requirement: 7, icon: "🔥", earned: false },
        { id: 3, name: "Month Master", description: "Maintain a 30-day streak", type: "streak", requirement: 30, icon: "💎", earned: false },
        { id: 4, name: "Hundred Hero", description: "Maintain a 100-day streak", type: "streak", requirement: 100, icon: "👑", earned: false },
        { id: 5, name: "Quarter Crusher", description: "Save 25% of starting debt", type: "savings", requirement: 0.25, icon: "⭐", earned: false },
        { id: 6, name: "Half Hero", description: "Save 50% of starting debt", type: "savings", requirement: 0.5, icon: "🌟", earned: false },
        { id: 7, name: "Debt Destroyer", description: "Save 100% of starting debt", type: "savings", requirement: 1.0, icon: "💰", earned: false },
        { id: 8, name: "Action Hero", description: "Complete 30 positive actions", type: "actions", requirement: 30, icon: "💪", earned: false },
        { id: 9, name: "Century Club", description: "Complete 100 positive actions", type: "actions", requirement: 100, icon: "🏆", earned: false },
        { id: 10, name: "Thousand Strong", description: "Complete 1000 positive actions", type: "actions", requirement: 1000, icon: "🎖️", earned: false }
      ]
    };
    this.workoutRoutines = {
      Monday: { focus: "Testosterone Boost - Heavy Compounds", exercises: [
        {name: "Barbell Squats", sets: 4, reps: "6-8", benefit: "Maximum testosterone response"},
        {name: "Deadlifts", sets: 4, reps: "5-6", benefit: "Full-body hormone activation"},
        {name: "Bench Press", sets: 4, reps: "6-8", benefit: "Upper body testosterone boost"},
        {name: "Pull-ups/Rows", sets: 3, reps: "8-10", benefit: "Back strength & posture"},
        {name: "HIIT Finisher", sets: 1, reps: "10 min", benefit: "Metabolic boost"}
      ]},
      Tuesday: { focus: "Cardio + Core - Triglyceride Burn", exercises: [
        {name: "Treadmill Intervals", sets: 1, reps: "20 min", benefit: "Triglyceride reduction"},
        {name: "Burpees", sets: 4, reps: "10-15", benefit: "Full-body fat burn"},
        {name: "Mountain Climbers", sets: 4, reps: "30 sec", benefit: "Core + cardio"},
        {name: "Plank Hold", sets: 3, reps: "60 sec", benefit: "Core stability"},
        {name: "Jump Rope", sets: 3, reps: "2 min", benefit: "Cardiovascular health"}
      ]},
      Wednesday: { focus: "Upper Body + Metabolic", exercises: [
        {name: "Overhead Press", sets: 4, reps: "8-10", benefit: "Shoulder strength + testosterone"},
        {name: "Dumbbell Rows", sets: 4, reps: "8-10", benefit: "Back development"},
        {name: "Dips", sets: 3, reps: "10-12", benefit: "Tricep + chest activation"},
        {name: "Battle Ropes", sets: 4, reps: "30 sec", benefit: "Metabolic conditioning"},
        {name: "Farmer Walks", sets: 3, reps: "40 steps", benefit: "Full-body strength"}
      ]},
      Thursday: { focus: "Lower Body + Cardio Circuit", exercises: [
        {name: "Goblet Squats", sets: 4, reps: "12-15", benefit: "Leg strength + endurance"},
        {name: "Romanian Deadlifts", sets: 4, reps: "10-12", benefit: "Hamstring + glute activation"},
        {name: "Walking Lunges", sets: 3, reps: "20 total", benefit: "Unilateral leg strength"},
        {name: "Stationary Bike HIIT", sets: 1, reps: "15 min", benefit: "Lower body cardio"},
        {name: "Calf Raises", sets: 3, reps: "20", benefit: "Lower leg strength"}
      ]},
      Friday: { focus: "Full Body Circuit - Week Finisher", exercises: [
        {name: "Thrusters", sets: 4, reps: "10", benefit: "Full-body power"},
        {name: "Kettlebell Swings", sets: 4, reps: "20", benefit: "Posterior chain + cardio"},
        {name: "Push-up to T", sets: 3, reps: "10 each side", benefit: "Core rotation + upper body"},
        {name: "Box Step-ups", sets: 3, reps: "15 each leg", benefit: "Leg power + balance"},
        {name: "Rowing Machine", sets: 1, reps: "10 min", benefit: "Full-body cardio finish"}
      ]}
    };
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.currentSection = 'dashboard';
  }

  async init() {
    await this.checkAuth();
    if (this.user) {
      await this.loadData();
      this.setupEventListeners();
      this.initializeTheme();
      this.setTodayDate();
      this.renderAll();
    } else {
      this.showNotification('Please sign in to continue.', 'info');
      // Optionally, redirect or show auth UI
    }
  }

  async checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    this.user = user;
    return user;
  }

  async loadData() {
    if (!this.user) return;

    // Load user settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', this.user.id)
      .single();
    if (settings) this.data.settings = settings;

    // Load actions
    const { data: actions } = await supabase
      .from('actions')
      .select('*')
      .eq('user_id', this.user.id);
    if (actions) this.data.actions = actions.map(a => ({ ...a, date: new Date(a.date) }));

    // Load action types (default + custom)
    const { data: actionTypes } = await supabase
      .from('action_types')
      .select('*')
      .or(`user_id.eq.${this.user.id},is_default.eq.true`);
    if (actionTypes) {
      this.data.actionTypes = {
        positive: actionTypes.filter(t => t.category === 'positive'),
        negative: actionTypes.filter(t => t.category === 'negative')
      };
    }

    // Load workout progress and custom workouts
    const { data: workouts } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', this.user.id);
    if (workouts) this.data.workoutProgress = Object.fromEntries(workouts.map(w => [w.date, w]));

    const { data: customWorkouts } = await supabase
      .from('custom_workouts')
      .select('*')
      .eq('user_id', this.user.id);
    if (customWorkouts) this.data.customWorkouts = Object.fromEntries(customWorkouts.map(c => [c.id, c]));
  }

  async saveSettings() {
    if (!this.user) return;
    const { error } = await supabase
      .from('user_settings')
      .upsert({ ...this.data.settings, user_id: this.user.id });
    if (!error) this.showNotification('Settings saved!', 'success');
    else this.showNotification('Failed to save settings.', 'error');
  }

  async addAction() {
    if (!this.user) return;
    const dateInput = document.getElementById('actionDate');
    const typeSelect = document.getElementById('addActionType');
    const notesInput = document.getElementById('actionNotes');
    const dateParts = dateInput.value.split('-');
    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const actionTypeId = parseInt(typeSelect.value);
    const notes = notesInput.value.trim();

    if (!actionTypeId) {
      this.showNotification('Please select an action type.', 'error');
      return;
    }

    // Check if action already exists for this date and type
    const { data: existing } = await supabase
      .from('actions')
      .select('*')
      .eq('user_id', this.user.id)
      .eq('action_type_id', actionTypeId)
      .eq('date', getDateString(date));
    if (existing && existing.length > 0) {
      this.showNotification('You can only add one action of this type per day.', 'error');
      return;
    }

    // Insert new action
    const { error } = await supabase
      .from('actions')
      .insert({
        user_id: this.user.id,
        action_type_id: actionTypeId,
        date: getDateString(date),
        notes
      });
    if (!error) {
      this.showNotification('Action added!', 'success');
      await this.loadData();
      this.renderAll();
      typeSelect.value = '';
      notesInput.value = '';
    } else {
      this.showNotification('Failed to add action.', 'error');
    }
  }

  async addQuickAction(actionTypeId) {
    if (!this.user) return;
    const today = new Date();
    // Check if action already exists for this date and type
    const { data: existing } = await supabase
      .from('actions')
      .select('*')
      .eq('user_id', this.user.id)
      .eq('action_type_id', actionTypeId)
      .eq('date', getDateString(today));
    if (existing && existing.length > 0) {
      this.showNotification('You have already added this action today.', 'error');
      return;
    }
    // Insert new action
    const { error } = await supabase
      .from('actions')
      .insert({
        user_id: this.user.id,
        action_type_id: actionTypeId,
        date: getDateString(today),
        notes: ''
      });
    if (!error) {
      this.showNotification('Quick action added!', 'success');
      await this.loadData();
      this.renderAll();
    } else {
      this.showNotification('Failed to add quick action.', 'error');
    }
  }

  async deleteAction(actionId) {
    if (!this.user) return;
    if (!confirm('Delete this action?')) return;
    const { error } = await supabase
      .from('actions')
      .delete()
      .eq('id', actionId)
      .eq('user_id', this.user.id);
    if (!error) {
      this.showNotification('Action deleted.', 'success');
      await this.loadData();
      this.renderAll();
    } else {
      this.showNotification('Failed to delete action.', 'error');
    }
  }

  async resetAllData() {
    if (!this.user) return;
    if (!confirm('Are you sure you want to reset ALL data? This cannot be undone.')) return;
    if (!confirm('This will delete all your actions, workouts, and settings. Are you absolutely sure?')) return;
    // Delete actions
    await supabase.from('actions').delete().eq('user_id', this.user.id);
    // Delete workout sessions
    await supabase.from('workout_sessions').delete().eq('user_id', this.user.id);
    // Reset user settings (except custom action types)
    await supabase.from('user_settings').delete().eq('user_id', this.user.id);
    // Reload data
    await this.loadData();
    this.renderAll();
    this.showNotification('All data reset. Custom action types preserved.', 'success');
  }

  async saveWorkout(day, exercises, isCustom = false) {
    if (!this.user) return;
    const today = new Date();
    const workoutName = isCustom ? 'Custom Workout' : this.workoutRoutines[day].focus;
    const { error } = await supabase
      .from('workout_sessions')
      .upsert({
        user_id: this.user.id,
        workout_name: workoutName,
        workout_type: isCustom ? 'custom' : 'predefined',
        exercises: exercises,
        date: getDateString(today)
      });
    if (!error) {
      this.showNotification('Workout saved!', 'success');
      await this.loadData();
      this.renderAll();
    } else {
      this.showNotification('Failed to save workout.', 'error');
    }
  }

  calculateStats() {
    const totalEarned = this.data.actions
      .filter(a => this.findActionType(a.action_type_id)?.value > 0)
      .reduce((sum, a) => sum + (this.findActionType(a.action_type_id)?.value || 0), 0);
    const totalLost = Math.abs(this.data.actions
      .filter(a => this.findActionType(a.action_type_id)?.value < 0)
      .reduce((sum, a) => sum + (this.findActionType(a.action_type_id)?.value || 0), 0));
    const netGain = totalEarned - totalLost;
    const currentBalance = this.data.settings.targetGoal - netGain;
    const progressPercent = Math.max(0, Math.min(100, (netGain / this.data.settings.targetGoal) * 100));
    // Streak calculation (simplified for demo)
    let currentStreak = 0;
    const sortedActions = this.data.actions
      .filter(a => this.findActionType(a.action_type_id)?.value > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortedActions.length > 0) {
      const today = new Date();
      const todayStr = getDateString(today);
      const yesterdayStr = getDateString(new Date(today.getTime() - 86400000));
      const hasRecentAction = sortedActions.some(a => getDateString(a.date) === todayStr || getDateString(a.date) === yesterdayStr);
      if (hasRecentAction) {
        let streakDate = new Date(today);
        while (currentStreak < 365) {
          const dateStr = getDateString(streakDate);
          if (sortedActions.some(a => getDateString(a.date) === dateStr)) {
            currentStreak++;
            streakDate.setDate(streakDate.getDate() - 1);
          } else break;
        }
      }
    }
    // Today's actions
    const today = new Date();
    const todayStr = getDateString(today);
    const todayActions = this.data.actions.filter(a => getDateString(a.date) === todayStr).length;
    return { totalEarned, totalLost, netGain, currentBalance, progressPercent, currentStreak, todayActions };
  }

  updateBadges() {
    const stats = this.calculateStats();
    const totalActions = this.data.actions.length;
    const positiveActions = this.data.actions.filter(a => this.findActionType(a.action_type_id)?.value > 0).length;
    const savingsRatio = stats.netGain / this.data.settings.targetGoal;
    this.data.badges.forEach(badge => {
      let wasEarned = badge.earned;
      switch (badge.type) {
        case 'milestone': badge.earned = totalActions >= badge.requirement; break;
        case 'streak': badge.earned = stats.currentStreak >= badge.requirement; break;
        case 'savings': badge.earned = savingsRatio >= badge.requirement; break;
        case 'actions': badge.earned = positiveActions >= badge.requirement; break;
      }
      // Show notification for newly earned badges
      if (badge.earned && !wasEarned) this.showNotification(`🎉 Badge Earned: ${badge.name}!`, 'success');
    });
  }

  findActionType(id) {
    return [...this.data.actionTypes.positive, ...this.data.actionTypes.negative]
      .find(type => type.id === id);
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link, .nav-mobile-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const section = e.currentTarget.dataset.section;
        this.navigateToSection(section);
      });
    });
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    // Dashboard actions
    document.getElementById('addActionBtn').addEventListener('click', () => this.addAction());
    // Workout tabs
    document.querySelectorAll('.workout-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const day = e.currentTarget.dataset.day;
        this.renderWorkoutDay(day);
      });
    });
    // Calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderCalendar();
    });
    // Calendar action
    document.getElementById('addCalendarAction').addEventListener('click', () => this.addCalendarAction());
    // Profile settings
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
    document.getElementById('addPositiveActionType').addEventListener('click', () => this.addActionType('positive'));
    document.getElementById('addNegativeActionType').addEventListener('click', () => this.addActionType('negative'));
    document.getElementById('resetDataBtn').addEventListener('click', () => this.resetAllData());
    // Theme select
    document.getElementById('themeSelect').addEventListener('change', (e) => this.setTheme(e.target.value));
  }

  navigateToSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(section).classList.add('active');
    document.querySelectorAll('.nav-link, .nav-mobile-link').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelectorAll(`[data-section="${section}"]`).forEach(link => {
      link.classList.add('active');
    });
    this.currentSection = section;
    if (section === 'dashboard') this.renderDashboard();
    else if (section === 'workout') this.renderWorkout();
    else if (section === 'calendar') this.renderCalendar();
    else if (section === 'profile') this.renderProfile();
  }

  initializeTheme() {
    this.setTheme(this.data.settings.theme);
  }

  setTheme(theme) {
    this.data.settings.theme = theme;
    const root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-color-scheme', 'dark');
    else root.setAttribute('data-color-scheme', 'light');
    if (document.getElementById('themeSelect')) document.getElementById('themeSelect').value = theme;
    this.saveSettings();
  }

  toggleTheme() {
    const current = this.data.settings.theme;
    const next = current === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }

  setTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('actionDate').value = `${year}-${month}-${day}`;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: var(--color-${type === 'success' ? 'success' : 'primary'});
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideInRight 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  renderAll() {
    this.renderDashboard();
    this.renderWorkout();
    this.renderCalendar();
    this.renderProfile();
  }

  renderDashboard() {
    const stats = this.calculateStats();
    document.getElementById('targetGoal').textContent = formatCurrency(this.data.settings.targetGoal);
    document.getElementById('currentBalance').textContent = formatCurrency(stats.currentBalance);
    document.getElementById('totalSaved').textContent = formatCurrency(stats.netGain);
    document.getElementById('totalEarned').textContent = formatCurrency(stats.totalEarned);
    document.getElementById('totalLost').textContent = formatCurrency(stats.totalLost);
    document.getElementById('currentStreak').textContent = stats.currentStreak;
    document.getElementById('todayActions').textContent = stats.todayActions;
    this.updateProgressCircle(stats.progressPercent);
    document.getElementById('progressPercentage').textContent = `${Math.round(stats.progressPercent)}%`;
    this.renderQuickActions();
    this.populateActionTypeSelects();
    this.renderRecentActivities();
    this.renderBadges();
  }

  updateProgressCircle(percent) {
    const circle = document.getElementById('progressCircle');
    const circumference = 2 * Math.PI * 88;
    const offset = circumference - (percent / 100) * circumference;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = offset;
  }

  renderQuickActions() {
    const container = document.getElementById('quickActionsContainer');
    const today = new Date();
    const quickActionTypes = (this.data.settings.quickActions || [])
      .map(id => this.findActionType(id))
      .filter(Boolean);
    container.innerHTML = quickActionTypes.map(actionType => `
      <button class="btn ${actionType.value > 0 ? 'btn--primary' : 'btn--outline'}" 
              onclick="app.addQuickAction(${actionType.id})">
        ${actionType.name}
      </button>
    `).join('');
  }

  populateActionTypeSelects() {
    const selects = ['addActionType', 'calendarActionType'];
    const allTypes = [...this.data.actionTypes.positive, ...this.data.actionTypes.negative];
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (!select) return;
      const currentValue = select.value;
      select.innerHTML = '<option value="">Select action type</option>' + allTypes.map(type => `
        <option value="${type.id}">${type.name} (${type.value > 0 ? '+' : ''}${type.value})</option>
      `).join('');
      if (currentValue) select.value = currentValue;
    });
  }

  renderRecentActivities() {
    const container = document.getElementById('recentActivities');
    const recentActions = this.data.actions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    if (recentActions.length === 0) {
      container.innerHTML = '<p class="text-center text-secondary">No activities yet. Add your first action!</p>';
      return;
    }
    container.innerHTML = recentActions.map(action => {
      const type = this.findActionType(action.action_type_id);
      return `
        <div class="card mb-2">
          <div class="flex justify-between items-center">
            <div>
              <strong>${type?.name || 'Unknown'}</strong>
              <span class="text-secondary">${new Date(action.date).toLocaleDateString('en-IN')}</span>
            </div>
            <button class="btn btn--outline btn--sm" onclick="app.deleteAction('${action.id}')">Delete</button>
          </div>
          ${action.notes ? `<p class="mt-2">${action.notes}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  renderBadges() {
    const container = document.getElementById('badgesContainer');
    this.updateBadges();
    container.innerHTML = this.data.badges.map(badge => `
      <div class="card ${badge.earned ? 'border-success' : ''}">
        <div class="flex items-center gap-4">
          <span class="text-2xl">${badge.icon}</span>
          <div>
            <strong>${badge.name}</strong>
            <p class="text-secondary">${badge.description}</p>
          </div>
          ${badge.earned ? '<span class="status status--success">Earned</span>' : ''}
        </div>
      </div>
    `).join('');
  }

  renderWorkout() {
    const today = new Date();
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
    this.renderWorkoutDay(day);
  }

  renderWorkoutDay(day) {
    const container = document.getElementById('workoutDay');
    const isWeekend = day === 'Saturday' || day === 'Sunday';
    const routine = this.workoutRoutines[day] || { focus: 'Custom Workout', exercises: [] };
    const isCustom = !this.workoutRoutines[day];
    container.innerHTML = `
      <h2>${day}</h2>
      <p>${routine.focus}</p>
      <div class="workout-exercises">
        ${routine.exercises.map(ex => `
          <div class="card mb-2">
            <strong>${ex.name}</strong>
            <p>${ex.sets} sets × ${ex.reps} reps</p>
            <p class="text-secondary">${ex.benefit}</p>
          </div>
        `).join('')}
      </div>
      <button class="btn btn--primary mt-4" onclick="app.saveWorkout('${day}', ${JSON.stringify(routine.exercises)}, ${isCustom})">
        Complete Workout
      </button>
      <div class="mt-4">
        <button class="btn btn--outline" onclick="app.showCustomWorkoutModal('${day}')">
          Create Custom Workout
        </button>
      </div>
    `;
  }

  renderCalendar() {
    // Simplified calendar render for demo
    const container = document.getElementById('calendarContainer');
    container.innerHTML = '<h2>Calendar View</h2><p>Select a date to view or add actions.</p>';
  }

  renderProfile() {
    const container = document.getElementById('profileContainer');
    container.innerHTML = `
      <h2>Profile Settings</h2>
      <div class="card">
        <div class="form-group">
          <label class="form-label">Target Goal (₹)</label>
          <input type="number" class="form-control" id="targetGoalInput" value="${this.data.settings.targetGoal}">
        </div>
        <div class="form-group">
          <label class="form-label">Reminder Time</label>
          <input type="time" class="form-control" id="reminderTimeInput" value="${this.data.settings.reminderTime}">
        </div>
        <div class="form-group">
          <label class="form-label">Theme</label>
          <select class="form-control" id="themeSelect">
            <option value="light" ${this.data.settings.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${this.data.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="auto" ${this.data.settings.theme === 'auto' ? 'selected' : ''}>Auto</option>
          </select>
        </div>
        <button class="btn btn--primary" id="saveSettings">Save Settings</button>
      </div>
      <div class="card mt-4">
        <h3>Quick Actions</h3>
        <p>Select which actions appear in the dashboard quick actions section.</p>
        <div class="flex flex-wrap gap-2" id="quickActionsCheckboxes">
          ${[...this.data.actionTypes.positive, ...this.data.actionTypes.negative].map(type => `
            <label class="flex items-center gap-2">
              <input type="checkbox" value="${type.id}" ${this.data.settings.quickActions?.includes(type.id) ? 'checked' : ''}>
              ${type.name}
            </label>
          `).join('')}
        </div>
        <button class="btn btn--primary mt-2" onclick="app.saveQuickActions()">Save Quick Actions</button>
      </div>
      <div class="card mt-4">
        <h3>Add Custom Action Type</h3>
        <div class="flex gap-2">
          <button class="btn btn--primary" id="addPositiveActionType">Add Positive</button>
          <button class="btn btn--primary" id="addNegativeActionType">Add Negative</button>
        </div>
      </div>
      <div class="card mt-4 bg-error-light border-error">
        <h3 class="text-error">Danger Zone</h3>
        <p class="text-error">Reset all your data. This cannot be undone.</p>
        <button class="btn btn--outline btn--error" id="resetDataBtn">Reset All Data</button>
      </div>
    `;
  }

  async saveQuickActions() {
    const checkboxes = document.querySelectorAll('#quickActionsCheckboxes input[type="checkbox"]');
    const selected = Array.from(checkboxes)
      .filter(c => c.checked)
      .map(c => parseInt(c.value));
    this.data.settings.quickActions = selected;
    await this.saveSettings();
    this.showNotification('Quick actions saved!', 'success');
  }

  async addActionType(category) {
    const name = prompt(`Enter the name of the new ${category} action type:`);
    if (!name) return;
    const value = parseInt(prompt(`Enter the value (₹) for ${name}:`));
    if (isNaN(value)) {
      this.showNotification('Invalid value. Please enter a number.', 'error');
      return;
    }
    const { error } = await supabase
      .from('action_types')
      .insert({
        name,
        value: category === 'positive' ? value : -value,
        category,
        is_default: false,
        user_id: this.user.id
      });
    if (!error) {
      this.showNotification('Action type added!', 'success');
      await this.loadData();
      this.renderProfile();
    } else {
      this.showNotification('Failed to add action type.', 'error');
    }
  }

  showCustomWorkoutModal(day) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Create Custom Workout for ${day}</h2>
        <div id="customWorkoutExercises"></div>
        <button class="btn btn--primary" onclick="app.addCustomExercise()">Add Exercise</button>
        <button class="btn btn--outline mt-2" onclick="app.saveCustomWorkout('${day}')">Save Workout</button>
        <button class="btn btn--outline mt-2" onclick="modal.remove()">Cancel</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  addCustomExercise() {
    const container = document.getElementById('customWorkoutExercises');
    const exercise = {
      name: prompt('Exercise name:'),
      sets: parseInt(prompt('Number of sets:')),
      reps: prompt('Number of reps:'),
      benefit: prompt('Health benefit:')
    };
    container.innerHTML += `
      <div class="card mb-2">
        <strong>${exercise.name}</strong>
        <p>${exercise.sets} sets × ${exercise.reps} reps</p>
        <p class="text-secondary">${exercise.benefit}</p>
      </div>
    `;
  }

  async saveCustomWorkout(day) {
    const container = document.getElementById('customWorkoutExercises');
    const exercises = Array.from(container.querySelectorAll('.card')).map(card => ({
      name: card.querySelector('strong').textContent,
      sets: parseInt(card.querySelector('p').textContent.split(' ')[0]),
      reps: card.querySelector('p').textContent.split('×')[1].trim(),
      benefit: card.querySelector('.text-secondary').textContent
    }));
    await this.saveWorkout(day, exercises, true);
    document.querySelector('.modal').remove();
  }

  async addCalendarAction() {
    // Similar to addAction, but for selected date in calendar
    // Implement as needed
  }
}

// Initialize app
const app = new HabitideApp();
app.init();
window.app = app;
