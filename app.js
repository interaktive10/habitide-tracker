// Habitide App - Main JavaScript File

class HabitideApp {
    constructor() {
        this.data = {
            settings: {
                targetGoal: 20000,
                reminderTime: '20:00',
                theme: 'light',
                quickActions: [1, 2, 9, 10] // Default quick action IDs
            },
            actions: [],
            workoutProgress: {},
            customWorkouts: {}, // Store custom workouts for any day
            actionTypes: {
                positive: [
                    {id: 1, name: "Gym/Exercise", value: 1000, isDefault: true},
                    {id: 2, name: "Reading", value: 500, isDefault: true},
                    {id: 3, name: "Meditation", value: 300, isDefault: true},
                    {id: 4, name: "Cooking at Home", value: 800, isDefault: true},
                    {id: 5, name: "Extra Income", value: 2000, isDefault: true},
                    {id: 6, name: "Debt Payment", value: 5000, isDefault: true},
                    {id: 7, name: "Savings", value: 3000, isDefault: true},
                    {id: 8, name: "No Impulse Buy", value: 1500, isDefault: true}
                ],
                negative: [
                    {id: 9, name: "Eating Out", value: -1000, isDefault: true},
                    {id: 10, name: "Junk Food", value: -2000, isDefault: true},
                    {id: 11, name: "Missed Exercise", value: -500, isDefault: true},
                    {id: 12, name: "Impulse Shopping", value: -3000, isDefault: true},
                    {id: 13, name: "Entertainment Splurge", value: -2500, isDefault: true},
                    {id: 14, name: "Late Bill Payment", value: -1500, isDefault: true},
                    {id: 15, name: "Subscription Renewal", value: -1000, isDefault: true},
                    {id: 16, name: "Missed Savings Goal", value: -2000, isDefault: true}
                ]
            },
            badges: [
                {id: 1, name: "First Step", description: "Complete your first action", type: "milestone", requirement: 1, icon: "🎯", earned: false},
                {id: 2, name: "Week Warrior", description: "Maintain a 7-day streak", type: "streak", requirement: 7, icon: "🔥", earned: false},
                {id: 3, name: "Month Master", description: "Maintain a 30-day streak", type: "streak", requirement: 30, icon: "💎", earned: false},
                {id: 4, name: "Hundred Hero", description: "Maintain a 100-day streak", type: "streak", requirement: 100, icon: "👑", earned: false},
                {id: 5, name: "Quarter Crusher", description: "Save 25% of starting debt", type: "savings", requirement: 0.25, icon: "⭐", earned: false},
                {id: 6, name: "Half Hero", description: "Save 50% of starting debt", type: "savings", requirement: 0.5, icon: "🌟", earned: false},
                {id: 7, name: "Debt Destroyer", description: "Save 100% of starting debt", type: "savings", requirement: 1.0, icon: "💰", earned: false},
                {id: 8, name: "Action Hero", description: "Complete 30 positive actions", type: "actions", requirement: 30, icon: "💪", earned: false},
                {id: 9, name: "Century Club", description: "Complete 100 positive actions", type: "actions", requirement: 100, icon: "🏆", earned: false},
                {id: 10, name: "Thousand Strong", description: "Complete 1000 positive actions", type: "actions", requirement: 1000, icon: "🎖️", earned: false}
            ]
        };

        this.workoutRoutines = {
            Monday: {
                focus: "Testosterone Boost - Heavy Compounds",
                exercises: [
                    {name: "Barbell Squats", sets: 4, reps: "6-8", benefit: "Maximum testosterone response"},
                    {name: "Deadlifts", sets: 4, reps: "5-6", benefit: "Full-body hormone activation"},
                    {name: "Bench Press", sets: 4, reps: "6-8", benefit: "Upper body testosterone boost"},
                    {name: "Pull-ups/Rows", sets: 3, reps: "8-10", benefit: "Back strength & posture"},
                    {name: "HIIT Finisher", sets: 1, reps: "10 min", benefit: "Metabolic boost"}
                ]
            },
            Tuesday: {
                focus: "Cardio + Core - Triglyceride Burn",
                exercises: [
                    {name: "Treadmill Intervals", sets: 1, reps: "20 min", benefit: "Triglyceride reduction"},
                    {name: "Burpees", sets: 4, reps: "10-15", benefit: "Full-body fat burn"},
                    {name: "Mountain Climbers", sets: 4, reps: "30 sec", benefit: "Core + cardio"},
                    {name: "Plank Hold", sets: 3, reps: "60 sec", benefit: "Core stability"},
                    {name: "Jump Rope", sets: 3, reps: "2 min", benefit: "Cardiovascular health"}
                ]
            },
            Wednesday: {
                focus: "Upper Body + Metabolic",
                exercises: [
                    {name: "Overhead Press", sets: 4, reps: "8-10", benefit: "Shoulder strength + testosterone"},
                    {name: "Dumbbell Rows", sets: 4, reps: "8-10", benefit: "Back development"},
                    {name: "Dips", sets: 3, reps: "10-12", benefit: "Tricep + chest activation"},
                    {name: "Battle Ropes", sets: 4, reps: "30 sec", benefit: "Metabolic conditioning"},
                    {name: "Farmer Walks", sets: 3, reps: "40 steps", benefit: "Full-body strength"}
                ]
            },
            Thursday: {
                focus: "Lower Body + Cardio Circuit",
                exercises: [
                    {name: "Goblet Squats", sets: 4, reps: "12-15", benefit: "Leg strength + endurance"},
                    {name: "Romanian Deadlifts", sets: 4, reps: "10-12", benefit: "Hamstring + glute activation"},
                    {name: "Walking Lunges", sets: 3, reps: "20 total", benefit: "Unilateral leg strength"},
                    {name: "Stationary Bike HIIT", sets: 1, reps: "15 min", benefit: "Lower body cardio"},
                    {name: "Calf Raises", sets: 3, reps: "20", benefit: "Lower leg strength"}
                ]
            },
            Friday: {
                focus: "Full Body Circuit - Week Finisher",
                exercises: [
                    {name: "Thrusters", sets: 4, reps: "10", benefit: "Full-body power"},
                    {name: "Kettlebell Swings", sets: 4, reps: "20", benefit: "Posterior chain + cardio"},
                    {name: "Push-up to T", sets: 3, reps: "10 each side", benefit: "Core rotation + upper body"},
                    {name: "Box Step-ups", sets: 3, reps: "15 each leg", benefit: "Leg power + balance"},
                    {name: "Rowing Machine", sets: 1, reps: "10 min", benefit: "Full-body cardio finish"}
                ]
            }
        };

        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.currentSection = 'dashboard';

        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.initializeTheme();
        this.setTodayDate();
        this.renderAll();
    }

    loadData() {
        const savedData = localStorage.getItem('habitide-data');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            this.data = { ...this.data, ...parsed };
            // Convert date strings back to Date objects
            this.data.actions = this.data.actions.map(action => ({
                ...action,
                date: new Date(action.date),
                timestamp: new Date(action.timestamp)
            }));
            
            // Ensure quickActions exists
            if (!this.data.settings.quickActions) {
                this.data.settings.quickActions = [1, 2, 9, 10];
            }
        }
    }

    saveData() {
        localStorage.setItem('habitide-data', JSON.stringify(this.data));
    }

    resetAllData() {
        if (confirm('Are you sure you want to reset ALL data? This cannot be undone.')) {
            if (confirm('This will delete all your actions, workouts, and settings. Are you absolutely sure?')) {
                localStorage.removeItem('habitide-data');
                window.location.reload();
            }
        }
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
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Dashboard actions
        document.getElementById('addActionBtn').addEventListener('click', () => {
            this.addAction();
        });

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
        document.getElementById('addCalendarAction').addEventListener('click', () => {
            this.addCalendarAction();
        });

        // Profile settings
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('addPositiveActionType').addEventListener('click', () => {
            this.addActionType('positive');
        });

        document.getElementById('addNegativeActionType').addEventListener('click', () => {
            this.addActionType('negative');
        });

        document.getElementById('resetDataBtn').addEventListener('click', () => {
            this.resetAllData();
        });

        // Theme select
        document.getElementById('themeSelect').addEventListener('change', (e) => {
            this.setTheme(e.target.value);
        });
    }

    navigateToSection(section) {
        // Update active section
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(section).classList.add('active');

        // Update active nav links
        document.querySelectorAll('.nav-link, .nav-mobile-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelectorAll(`[data-section="${section}"]`).forEach(link => {
            link.classList.add('active');
        });

        this.currentSection = section;

        // Refresh data for specific sections
        if (section === 'dashboard') {
            this.renderDashboard();
        } else if (section === 'workout') {
            this.renderWorkout();
        } else if (section === 'calendar') {
            this.renderCalendar();
        } else if (section === 'profile') {
            this.renderProfile();
        }
    }

    initializeTheme() {
        this.setTheme(this.data.settings.theme);
    }

    setTheme(theme) {
        this.data.settings.theme = theme;
        const root = document.documentElement;
        
        if (theme === 'dark') {
            root.setAttribute('data-color-scheme', 'dark');
            document.getElementById('themeToggle').innerHTML = '<span class="theme-icon">☀️</span>';
        } else {
            root.setAttribute('data-color-scheme', 'light');
            document.getElementById('themeToggle').innerHTML = '<span class="theme-icon">🌙</span>';
        }

        if (document.getElementById('themeSelect')) {
            document.getElementById('themeSelect').value = theme;
        }
        this.saveData();
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

    formatCurrency(amount) {
        return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
    }

    formatDate(date) {
        return date.toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    getDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    findActionType(id) {
        return [...this.data.actionTypes.positive, ...this.data.actionTypes.negative]
            .find(type => type.id === id);
    }

    canAddAction(actionTypeId, date) {
        const dateStr = this.getDateString(date);
        const existingAction = this.data.actions.find(action => 
            action.actionTypeId === actionTypeId && 
            this.getDateString(action.date) === dateStr
        );
        return !existingAction;
    }

    addAction() {
        const dateInput = document.getElementById('actionDate');
        const typeSelect = document.getElementById('addActionType');
        const notesInput = document.getElementById('actionNotes');

        // Fix: Parse date properly to avoid timezone issues
        const dateParts = dateInput.value.split('-');
        const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        
        const actionTypeId = parseInt(typeSelect.value);
        const notes = notesInput.value.trim();

        if (!actionTypeId) {
            alert('Please select an action type');
            return;
        }

        if (!this.canAddAction(actionTypeId, date)) {
            alert('You can only add one action of this type per day');
            return;
        }

        const actionType = this.findActionType(actionTypeId);
        if (!actionType) return;

        const action = {
            id: Date.now(),
            actionTypeId: actionTypeId,
            actionType: actionType,
            date: date,
            notes: notes,
            timestamp: new Date()
        };

        this.data.actions.push(action);
        this.updateBadges();
        this.saveData();
        this.renderAll();

        // Clear form
        typeSelect.value = '';
        notesInput.value = '';

        // Show success message
        this.showNotification(`Added ${actionType.name} for ${this.formatDate(date)}`, 'success');
    }

    addQuickAction(actionTypeId) {
        const today = new Date();
        
        if (!this.canAddAction(actionTypeId, today)) {
            alert('You have already added this action today');
            return;
        }

        const actionType = this.findActionType(actionTypeId);
        if (!actionType) return;

        const action = {
            id: Date.now(),
            actionTypeId: actionTypeId,
            actionType: actionType,
            date: today,
            notes: '',
            timestamp: new Date()
        };

        this.data.actions.push(action);
        this.updateBadges();
        this.saveData();
        this.renderAll();

        this.showNotification(`Added ${actionType.name}!`, 'success');
    }

    deleteAction(actionId) {
        if (confirm('Delete this action?')) {
            this.data.actions = this.data.actions.filter(action => action.id !== actionId);
            this.saveData();
            this.renderAll();
        }
    }

    calculateStats() {
        const totalEarned = this.data.actions
            .filter(action => action.actionType.value > 0)
            .reduce((sum, action) => sum + action.actionType.value, 0);

        const totalLost = Math.abs(this.data.actions
            .filter(action => action.actionType.value < 0)
            .reduce((sum, action) => sum + action.actionType.value, 0));

        const netGain = totalEarned - totalLost;
        const currentBalance = this.data.settings.targetGoal - netGain;
        const progressPercent = Math.max(0, Math.min(100, (netGain / this.data.settings.targetGoal) * 100));

        // Calculate streak
        const sortedActions = this.data.actions
            .filter(action => action.actionType.value > 0)
            .sort((a, b) => b.date - a.date);

        let currentStreak = 0;
        if (sortedActions.length > 0) {
            const today = new Date();
            const todayStr = this.getDateString(today);
            const yesterdayStr = this.getDateString(new Date(today.getTime() - 86400000));

            // Check if there's a positive action today or yesterday
            const hasRecentAction = sortedActions.some(action => {
                const actionDateStr = this.getDateString(action.date);
                return actionDateStr === todayStr || actionDateStr === yesterdayStr;
            });

            if (hasRecentAction) {
                let streakDate = new Date(today);
                currentStreak = 0;

                // Count consecutive days with positive actions
                while (currentStreak < 365) { // Limit to prevent infinite loop
                    const dateStr = this.getDateString(streakDate);
                    const hasActionOnDate = sortedActions.some(action => 
                        this.getDateString(action.date) === dateStr
                    );

                    if (hasActionOnDate) {
                        currentStreak++;
                        streakDate.setDate(streakDate.getDate() - 1);
                    } else {
                        break;
                    }
                }
            }
        }

        // Today's actions count
        const today = new Date();
        const todayStr = this.getDateString(today);
        const todayActions = this.data.actions.filter(action => 
            this.getDateString(action.date) === todayStr
        ).length;

        return {
            totalEarned,
            totalLost,
            netGain,
            currentBalance,
            progressPercent,
            currentStreak,
            todayActions
        };
    }

    updateBadges() {
        const stats = this.calculateStats();
        const totalActions = this.data.actions.length;
        const positiveActions = this.data.actions.filter(action => action.actionType.value > 0).length;
        const savingsRatio = stats.netGain / this.data.settings.targetGoal;

        this.data.badges.forEach(badge => {
            let wasEarned = badge.earned;
            
            switch (badge.type) {
                case 'milestone':
                    badge.earned = totalActions >= badge.requirement;
                    break;
                case 'streak':
                    badge.earned = stats.currentStreak >= badge.requirement;
                    break;
                case 'savings':
                    badge.earned = savingsRatio >= badge.requirement;
                    break;
                case 'actions':
                    badge.earned = positiveActions >= badge.requirement;
                    break;
            }

            // Show notification for newly earned badges
            if (badge.earned && !wasEarned) {
                this.showNotification(`🎉 Badge Earned: ${badge.name}!`, 'success');
            }
        });
    }

    showNotification(message, type = 'info') {
        // Simple notification system
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

        // Update main stats
        document.getElementById('targetGoal').textContent = this.formatCurrency(this.data.settings.targetGoal);
        document.getElementById('currentBalance').textContent = this.formatCurrency(stats.currentBalance);
        document.getElementById('totalSaved').textContent = this.formatCurrency(stats.netGain);

        // Update health stats
        document.getElementById('totalEarned').textContent = this.formatCurrency(stats.totalEarned);
        document.getElementById('totalLost').textContent = this.formatCurrency(stats.totalLost);
        document.getElementById('currentStreak').textContent = stats.currentStreak;
        document.getElementById('todayActions').textContent = stats.todayActions;

        // Update progress circle
        this.updateProgressCircle(stats.progressPercent);
        document.getElementById('progressPercentage').textContent = `${Math.round(stats.progressPercent)}%`;

        // Render quick actions
        this.renderQuickActions();

        // Populate action type selects
        this.populateActionTypeSelects();

        // Render recent activities
        this.renderRecentActivities();

        // Render badges
        this.renderBadges();
    }

    updateProgressCircle(percent) {
        const circle = document.getElementById('progressCircle');
        const circumference = 2 * Math.PI * 88; // radius = 88
        const offset = circumference - (percent / 100) * circumference;
        
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
    }

    renderQuickActions() {
        const container = document.getElementById('quickActionsContainer');
        const today = new Date();
        
        // Use user-selected quick actions
        const quickActionTypes = this.data.settings.quickActions.map(id => this.findActionType(id)).filter(Boolean);

        container.innerHTML = quickActionTypes.map(actionType => {
            const canAdd = this.canAddAction(actionType.id, today);
            const buttonClass = actionType.value > 0 ? 'btn--primary' : 'btn--outline';
            
            return `
                <button class="btn ${buttonClass} quick-action-btn" 
                        onclick="app.addQuickAction(${actionType.id})"
                        ${!canAdd ? 'disabled' : ''}>
                    ${actionType.name} (${actionType.value > 0 ? '+' : ''}${this.formatCurrency(actionType.value)})
                    ${!canAdd ? '✓' : ''}
                </button>
            `;
        }).join('');
    }

    populateActionTypeSelects() {
        const selects = ['addActionType', 'calendarActionType'];
        const allTypes = [...this.data.actionTypes.positive, ...this.data.actionTypes.negative];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;

            const currentValue = select.value;
            select.innerHTML = '<option value="">Choose an action...</option>' +
                allTypes.map(type => 
                    `<option value="${type.id}">${type.name} (${type.value > 0 ? '+' : ''}${this.formatCurrency(type.value)})</option>`
                ).join('');
            
            if (currentValue) select.value = currentValue;
        });
    }

    renderRecentActivities() {
        const container = document.getElementById('recentActivities');
        const recentActions = this.data.actions
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5);

        if (recentActions.length === 0) {
            container.innerHTML = '<p class="empty-state">No activities yet. Add your first action!</p>';
            return;
        }

        container.innerHTML = recentActions.map(action => `
            <div class="activity-item">
                <div class="activity-details">
                    <div class="activity-name">${action.actionType.name}</div>
                    <div class="activity-date">${this.formatDate(action.date)}</div>
                </div>
                <div class="activity-value ${action.actionType.value > 0 ? 'positive' : 'negative'}">
                    ${action.actionType.value > 0 ? '+' : ''}${this.formatCurrency(action.actionType.value)}
                </div>
            </div>
        `).join('');
    }

    renderBadges() {
        const container = document.getElementById('badgesGrid');
        container.innerHTML = this.data.badges.map(badge => `
            <div class="badge ${badge.earned ? 'earned' : ''}">
                <div class="badge-icon">${badge.icon}</div>
                <div class="badge-name">${badge.name}</div>
                <div class="badge-description">${badge.description}</div>
            </div>
        `).join('');
    }

    renderWorkout() {
        this.renderWorkoutDay('Monday');
    }

    renderWorkoutDay(day) {
        // Update active tab
        document.querySelectorAll('.workout-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-day="${day}"]`).classList.add('active');

        const container = document.getElementById('workoutContent');

        // Check if it's a weekend day or if user has custom workout
        const isWeekend = day === 'Saturday' || day === 'Sunday';
        const hasCustomWorkout = this.data.customWorkouts[day];
        const hasStandardRoutine = this.workoutRoutines[day];

        if (isWeekend && !hasCustomWorkout) {
            // Show custom workout option for weekends
            container.innerHTML = `
                <div class="custom-workout-setup">
                    <h2>${day} - Custom Workout</h2>
                    <p>Create your own workout routine for ${day}</p>
                    <div class="custom-workout-form">
                        <input type="text" id="customWorkoutName" placeholder="Workout name" class="form-control">
                        <textarea id="customWorkoutDescription" placeholder="Describe your workout..." class="form-control" rows="4"></textarea>
                        <button class="btn btn--primary" onclick="app.saveCustomWorkout('${day}')">Save Custom Workout</button>
                    </div>
                </div>
            `;
            return;
        }

        // Determine which routine to show
        let routine;
        let isCustom = false;
        
        if (hasCustomWorkout) {
            routine = hasCustomWorkout;
            isCustom = true;
        } else if (hasStandardRoutine) {
            routine = hasStandardRoutine;
        } else {
            // Fallback for weekends without custom workout
            container.innerHTML = `
                <div class="custom-workout-setup">
                    <h2>${day} - Custom Workout</h2>
                    <p>Create your own workout routine for ${day}</p>
                    <button class="btn btn--primary" onclick="app.setupCustomWorkout('${day}')">Setup Custom Workout</button>
                </div>
            `;
            return;
        }

        const progress = this.data.workoutProgress[day] || {};

        container.innerHTML = `
            <div class="workout-day">
                <div class="workout-header">
                    <h2>${day}</h2>
                    <p class="workout-focus">${routine.focus || routine.description || 'Custom Workout'}</p>
                    ${isCustom ? `<button class="btn btn--outline btn--sm" onclick="app.editCustomWorkout('${day}')">Edit Custom Workout</button>` : ''}
                </div>
                
                <div class="exercises-list">
                    ${(routine.exercises || []).map((exercise, index) => `
                        <div class="exercise">
                            <input type="checkbox" class="exercise-checkbox" 
                                   data-day="${day}" data-exercise="${index}"
                                   ${progress[index] ? 'checked' : ''}>
                            <div class="exercise-details">
                                <div class="exercise-name">${exercise.name}</div>
                                <div class="exercise-sets">${exercise.sets} sets × ${exercise.reps}</div>
                                <div class="exercise-benefit">${exercise.benefit}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${!isCustom ? `<div class="add-custom-workout">
                    <button class="btn btn--outline" onclick="app.setupCustomWorkout('${day}')">Add Custom Workout for ${day}</button>
                </div>` : ''}
            </div>
        `;

        // Add event listeners for checkboxes
        container.querySelectorAll('.exercise-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleExercise(e.target.dataset.day, parseInt(e.target.dataset.exercise), e.target.checked);
            });
        });
    }

    setupCustomWorkout(day) {
        const container = document.getElementById('workoutContent');
        container.innerHTML = `
            <div class="custom-workout-setup">
                <h2>${day} - Custom Workout</h2>
                <div class="custom-workout-form">
                    <div class="form-group">
                        <label class="form-label">Workout Name</label>
                        <input type="text" id="customWorkoutName" placeholder="e.g., Full Body Strength" class="form-control">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea id="customWorkoutDescription" placeholder="Brief description of the workout..." class="form-control" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Exercises (one per line: Exercise Name | Sets | Reps | Benefit)</label>
                        <textarea id="customWorkoutExercises" placeholder="Push-ups | 3 | 10-15 | Upper body strength&#10;Squats | 3 | 12-15 | Leg strength" class="form-control" rows="8"></textarea>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn--primary" onclick="app.saveCustomWorkout('${day}')">Save Custom Workout</button>
                        <button class="btn btn--outline" onclick="app.renderWorkoutDay('${day}')">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }

    saveCustomWorkout(day) {
        const name = document.getElementById('customWorkoutName').value.trim();
        const description = document.getElementById('customWorkoutDescription').value.trim();
        const exercisesText = document.getElementById('customWorkoutExercises').value.trim();

        if (!name || !exercisesText) {
            alert('Please provide a workout name and exercises');
            return;
        }

        // Parse exercises
        const exercises = exercisesText.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length >= 3) {
                    return {
                        name: parts[0],
                        sets: parts[1],
                        reps: parts[2],
                        benefit: parts[3] || 'Custom exercise'
                    };
                }
                return null;
            })
            .filter(Boolean);

        if (exercises.length === 0) {
            alert('Please add at least one valid exercise');
            return;
        }

        // Save custom workout
        this.data.customWorkouts[day] = {
            focus: name,
            description: description,
            exercises: exercises
        };

        this.saveData();
        this.renderWorkoutDay(day);
        this.showNotification(`Custom workout for ${day} saved!`, 'success');
    }

    editCustomWorkout(day) {
        const workout = this.data.customWorkouts[day];
        if (!workout) return;

        const container = document.getElementById('workoutContent');
        const exercisesText = workout.exercises.map(ex => 
            `${ex.name} | ${ex.sets} | ${ex.reps} | ${ex.benefit}`
        ).join('\n');

        container.innerHTML = `
            <div class="custom-workout-setup">
                <h2>Edit ${day} - Custom Workout</h2>
                <div class="custom-workout-form">
                    <div class="form-group">
                        <label class="form-label">Workout Name</label>
                        <input type="text" id="customWorkoutName" value="${workout.focus}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea id="customWorkoutDescription" class="form-control" rows="3">${workout.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Exercises (one per line: Exercise Name | Sets | Reps | Benefit)</label>
                        <textarea id="customWorkoutExercises" class="form-control" rows="8">${exercisesText}</textarea>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn--primary" onclick="app.saveCustomWorkout('${day}')">Save Changes</button>
                        <button class="btn btn--outline" onclick="app.renderWorkoutDay('${day}')">Cancel</button>
                        <button class="btn btn--outline" onclick="app.deleteCustomWorkout('${day}')">Delete Custom Workout</button>
                    </div>
                </div>
            </div>
        `;
    }

    deleteCustomWorkout(day) {
        if (confirm(`Delete custom workout for ${day}?`)) {
            delete this.data.customWorkouts[day];
            this.saveData();
            this.renderWorkoutDay(day);
            this.showNotification(`Custom workout for ${day} deleted`, 'success');
        }
    }

    toggleExercise(day, exerciseIndex, completed) {
        if (!this.data.workoutProgress[day]) {
            this.data.workoutProgress[day] = {};
        }
        
        this.data.workoutProgress[day][exerciseIndex] = completed;
        this.saveData();
        this.renderDashboard();
    }

    renderCalendar() {
        this.renderCalendarHeader();
        this.renderCalendarGrid();
        this.selectDate(this.selectedDate);
    }

    renderCalendarHeader() {
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        
        document.getElementById('currentMonth').textContent = 
            `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    }

    renderCalendarGrid() {
        const container = document.getElementById('calendarGrid');
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        let html = '';
        
        // Day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        
        // Previous month days
        const prevMonth = new Date(year, month - 1, 0);
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonth.getDate() - i;
            html += `<div class="calendar-day other-month">
                        <div class="day-number">${day}</div>
                     </div>`;
        }
        
        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            // Fix: Use proper date construction to avoid timezone issues
            const date = new Date(year, month, day);
            const dateStr = this.getDateString(date);
            const isToday = dateStr === this.getDateString(new Date());
            const isSelected = dateStr === this.getDateString(this.selectedDate);
            
            const dayActions = this.data.actions.filter(action => 
                this.getDateString(action.date) === dateStr
            );
            
            const dayTotal = dayActions.reduce((sum, action) => sum + action.actionType.value, 0);
            
            html += `<div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
                           data-year="${year}" data-month="${month}" data-day="${day}">
                        <div class="day-number">${day}</div>
                        <div class="day-actions-summary">
                            ${dayActions.slice(0, 3).map(action => 
                                `<span class="action-dot ${action.actionType.value > 0 ? 'positive' : 'negative'}"></span>`
                            ).join('')}
                            ${dayActions.length > 3 ? '...' : ''}
                        </div>
                        ${dayTotal !== 0 ? `<div class="day-total ${dayTotal > 0 ? 'positive' : 'negative'}">
                            ${dayTotal > 0 ? '+' : ''}${this.formatCurrency(dayTotal)}
                        </div>` : ''}
                     </div>`;
        }
        
        // Next month days
        const remainingCells = 42 - (firstDayOfWeek + daysInMonth);
        for (let day = 1; day <= remainingCells; day++) {
            html += `<div class="calendar-day other-month">
                        <div class="day-number">${day}</div>
                     </div>`;
        }
        
        container.innerHTML = html;
        
        // Add click listeners
        container.querySelectorAll('.calendar-day:not(.other-month)').forEach(day => {
            day.addEventListener('click', (e) => {
                const year = parseInt(e.currentTarget.dataset.year);
                const month = parseInt(e.currentTarget.dataset.month);
                const dayNum = parseInt(e.currentTarget.dataset.day);
                // Fix: Use proper date construction
                this.selectDate(new Date(year, month, dayNum));
            });
        });
    }

    selectDate(date) {
        this.selectedDate = date;
        this.renderCalendarGrid();
        this.renderSelectedDateActions();
    }

    renderSelectedDateActions() {
        const dateStr = this.getDateString(this.selectedDate);
        document.getElementById('selectedDateDisplay').textContent = this.formatDate(this.selectedDate);
        
        const dayActions = this.data.actions.filter(action => 
            this.getDateString(action.date) === dateStr
        );
        
        const container = document.getElementById('selectedDateActions');
        
        if (dayActions.length === 0) {
            container.innerHTML = '<p class="empty-state">No actions for this date</p>';
            return;
        }
        
        container.innerHTML = dayActions.map(action => `
            <div class="activity-item">
                <div class="activity-details">
                    <div class="activity-name">${action.actionType.name}</div>
                    ${action.notes ? `<div class="activity-date">${action.notes}</div>` : ''}
                </div>
                <div class="activity-value ${action.actionType.value > 0 ? 'positive' : 'negative'}">
                    ${action.actionType.value > 0 ? '+' : ''}${this.formatCurrency(action.actionType.value)}
                </div>
                <button class="action-delete" onclick="app.deleteAction(${action.id})">×</button>
            </div>
        `).join('');
    }

    addCalendarAction() {
        const select = document.getElementById('calendarActionType');
        const actionTypeId = parseInt(select.value);
        
        if (!actionTypeId) return;

        if (!this.canAddAction(actionTypeId, this.selectedDate)) {
            alert('This action has already been added for this date');
            return;
        }
        
        const actionType = this.findActionType(actionTypeId);
        if (actionType) {
            const action = {
                id: Date.now(),
                actionTypeId: actionTypeId,
                actionType: actionType,
                date: new Date(this.selectedDate),
                notes: '',
                timestamp: new Date()
            };

            this.data.actions.push(action);
            this.updateBadges();
            this.saveData();
            this.renderSelectedDateActions();
            this.renderCalendarGrid();
            this.renderDashboard();
            select.value = '';
        }
    }

    renderProfile() {
        // Update form values
        document.getElementById('targetGoalInput').value = this.data.settings.targetGoal;
        document.getElementById('reminderTime').value = this.data.settings.reminderTime;
        document.getElementById('themeSelect').value = this.data.settings.theme;

        // Render action types
        this.renderActionTypesList('positive', 'positiveActionsList');
        this.renderActionTypesList('negative', 'negativeActionsList');

        // Render quick actions selection
        this.renderQuickActionsSelection();

        // Render badge progress
        this.renderBadgeProgress();
    }

    renderQuickActionsSelection() {
        const container = document.getElementById('quickActionsSelection');
        const allTypes = [...this.data.actionTypes.positive, ...this.data.actionTypes.negative];
        
        container.innerHTML = allTypes.map(type => `
            <div class="quick-action-option">
                <label class="checkbox-label">
                    <input type="checkbox" 
                           ${this.data.settings.quickActions.includes(type.id) ? 'checked' : ''}
                           onchange="app.toggleQuickAction(${type.id})">
                    <span class="checkmark"></span>
                    ${type.name} (${type.value > 0 ? '+' : ''}${this.formatCurrency(type.value)})
                </label>
            </div>
        `).join('');
    }

    toggleQuickAction(actionId) {
        const index = this.data.settings.quickActions.indexOf(actionId);
        if (index > -1) {
            this.data.settings.quickActions.splice(index, 1);
        } else {
            this.data.settings.quickActions.push(actionId);
        }
        this.saveData();
        this.renderQuickActions(); // Update dashboard quick actions
    }

    renderActionTypesList(type, containerId) {
        const container = document.getElementById(containerId);
        const actions = this.data.actionTypes[type];
        
        container.innerHTML = actions.map(action => `
            <div class="action-type-item">
                <div class="action-type-info">
                    <div class="action-type-name">${action.name}</div>
                    <div class="action-type-value ${type}">${action.value > 0 ? '+' : ''}${this.formatCurrency(action.value)}</div>
                </div>
                <div class="action-type-actions">
                    <button class="action-edit" onclick="app.editActionType('${type}', ${action.id})">Edit</button>
                    ${!action.isDefault ? `<button class="action-delete" onclick="app.deleteActionType('${type}', ${action.id})">Delete</button>` : ''}
                </div>
            </div>
        `).join('');
    }

    renderBadgeProgress() {
        const container = document.getElementById('badgeProgressList');
        const stats = this.calculateStats();
        
        container.innerHTML = this.data.badges.map(badge => {
            let progress = 0;
            let current = 0;
            
            switch (badge.type) {
                case 'milestone':
                    current = this.data.actions.length;
                    break;
                case 'streak':
                    current = stats.currentStreak;
                    break;
                case 'savings':
                    current = Math.round((stats.netGain / this.data.settings.targetGoal) * 100);
                    const requirement = Math.round(badge.requirement * 100);
                    progress = Math.min(100, (current / requirement) * 100);
                    return `
                        <div class="badge-progress-item">
                            <div class="badge-info">
                                <span class="badge-icon">${badge.icon}</span>
                                <div>
                                    <div class="badge-name">${badge.name}</div>
                                    <div class="badge-progress-text">${current}%/${requirement}%</div>
                                </div>
                            </div>
                            <div class="badge-progress-bar">
                                <div class="badge-progress-fill" style="width: ${progress}%"></div>
                            </div>
                        </div>
                    `;
                case 'actions':
                    current = this.data.actions.filter(a => a.actionType.value > 0).length;
                    break;
            }
            
            progress = Math.min(100, (current / badge.requirement) * 100);
            
            return `
                <div class="badge-progress-item">
                    <div class="badge-info">
                        <span class="badge-icon">${badge.icon}</span>
                        <div>
                            <div class="badge-name">${badge.name}</div>
                            <div class="badge-progress-text">${current}/${badge.requirement}</div>
                        </div>
                    </div>
                    <div class="badge-progress-bar">
                        <div class="badge-progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    saveSettings() {
        this.data.settings.targetGoal = parseInt(document.getElementById('targetGoalInput').value);
        this.data.settings.reminderTime = document.getElementById('reminderTime').value;
        this.data.settings.theme = document.getElementById('themeSelect').value;
        
        this.setTheme(this.data.settings.theme);
        this.saveData();
        this.renderDashboard();
        
        this.showNotification('Settings saved successfully!', 'success');
    }

    addActionType(type) {
        const nameInput = document.getElementById(`new${type.charAt(0).toUpperCase() + type.slice(1)}ActionName`);
        const valueInput = document.getElementById(`new${type.charAt(0).toUpperCase() + type.slice(1)}ActionValue`);
        
        const name = nameInput.value.trim();
        const value = parseInt(valueInput.value);
        
        if (!name || !value) {
            alert('Please enter both name and value');
            return;
        }
        
        const newAction = {
            id: Date.now(),
            name: name,
            value: type === 'negative' ? -Math.abs(value) : Math.abs(value),
            isDefault: false
        };
        
        this.data.actionTypes[type].push(newAction);
        this.saveData();
        this.renderProfile();
        this.populateActionTypeSelects();
        
        nameInput.value = '';
        valueInput.value = '';
        
        this.showNotification(`Added ${name} action type`, 'success');
    }

    editActionType(type, id) {
        const action = this.data.actionTypes[type].find(a => a.id === id);
        if (!action) return;
        
        const newName = prompt('Edit action name:', action.name);
        const newValue = parseInt(prompt('Edit action value:', Math.abs(action.value)));
        
        if (newName && newValue) {
            action.name = newName;
            action.value = type === 'negative' ? -Math.abs(newValue) : Math.abs(newValue);
            this.saveData();
            this.renderProfile();
            this.populateActionTypeSelects();
            this.showNotification('Action type updated', 'success');
        }
    }

    deleteActionType(type, id) {
        if (confirm('Delete this action type?')) {
            this.data.actionTypes[type] = this.data.actionTypes[type].filter(a => a.id !== id);
            // Remove from quick actions if present
            this.data.settings.quickActions = this.data.settings.quickActions.filter(actionId => actionId !== id);
            this.saveData();
            this.renderProfile();
            this.populateActionTypeSelects();
            this.renderQuickActions();
            this.showNotification('Action type deleted', 'success');
        }
    }
}

// Add notification animations to head
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .badge-progress-item {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-12);
        background: var(--color-secondary);
        border-radius: var(--radius-base);
        margin-bottom: var(--space-8);
    }
    .badge-info {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        min-width: 150px;
    }
    .badge-progress-bar {
        flex: 1;
        height: 8px;
        background: var(--color-border);
        border-radius: var(--radius-full);
        overflow: hidden;
    }
    .badge-progress-fill {
        height: 100%;
        background: var(--gradient-primary);
        border-radius: var(--radius-full);
        transition: width var(--duration-normal) var(--ease-standard);
    }
    .badge-progress-text {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
    }
    .quick-action-option {
        margin-bottom: var(--space-8);
    }
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        cursor: pointer;
        padding: var(--space-8);
        border-radius: var(--radius-base);
        transition: background var(--duration-fast) var(--ease-standard);
    }
    .checkbox-label:hover {
        background: var(--color-secondary);
    }
    .custom-workout-setup {
        max-width: 600px;
        margin: 0 auto;
        text-align: center;
    }
    .custom-workout-form {
        text-align: left;
        margin-top: var(--space-24);
    }
    .form-actions {
        display: flex;
        gap: var(--space-12);
        justify-content: center;
        margin-top: var(--space-24);
    }
    .add-custom-workout {
        text-align: center;
        margin-top: var(--space-24);
        padding-top: var(--space-24);
        border-top: 1px solid var(--color-border);
    }
`;
document.head.appendChild(style);

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new HabitideApp();
});