// API configuration - Update this with your Render backend URL
const API_BASE_URL = 'https://kedia-crm-backend.onrender.com/api'; // Replace with your actual Render backend URL

// API service functions
const apiService = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (config.body && typeof config.body !== 'string') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    // Auth
    async login(credentials) {
        return this.request('/auth/login', {
            method: 'POST',
            body: credentials,
        });
    },

    async verifyToken() {
        return this.request('/auth/verify');
    },

    // Users
    async getUsers() {
        return this.request('/users');
    },

    async createUser(userData) {
        return this.request('/users', {
            method: 'POST',
            body: userData,
        });
    },

    async updateUser(id, userData) {
        return this.request(`/users/${id}`, {
            method: 'PUT',
            body: userData,
        });
    },

    async deleteUser(id) {
        return this.request(`/users/${id}`, {
            method: 'DELETE',
        });
    },

    // Tasks
    async getTasks(filters = {}) {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key]) params.append(key, filters[key]);
        });
        
        return this.request(`/tasks?${params}`);
    },

    async createTask(taskData) {
        return this.request('/tasks', {
            method: 'POST',
            body: taskData,
        });
    },

    async updateTask(id, taskData) {
        return this.request(`/tasks/${id}`, {
            method: 'PUT',
            body: taskData,
        });
    },

    async deleteTask(id) {
        return this.request(`/tasks/${id}`, {
            method: 'DELETE',
        });
    },

    async getDashboardStats() {
        return this.request('/tasks/dashboard/stats');
    },
};

// Global variables
let currentUser = null;
let editingTaskId = null;
let editingStaffId = null;
let editingAdminId = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const currentUserName = document.getElementById('currentUserName');
const logoutLink = document.getElementById('logoutLink');
const sidebarLinks = document.querySelectorAll('.sidebar .nav-link');
const contentSections = document.querySelectorAll('.content-section');
const adminOnlyElements = document.querySelectorAll('.admin-only');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('token');
    
    if (savedUser && token) {
        verifyTokenAndLoadApp();
    }

    // Login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const loginBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<span class="loading-spinner"></span> Logging in...';
            loginBtn.disabled = true;

            const { token, user } = await apiService.login({ email, password });
            localStorage.setItem('token', token);
            localStorage.setItem('currentUser', JSON.stringify(user));
            currentUser = user;
            showAppScreen();

            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        } catch (error) {
            showAlert(error.message || 'Login failed!', 'danger');
            const loginBtn = loginForm.querySelector('button[type="submit"]');
            loginBtn.innerHTML = 'Login';
            loginBtn.disabled = false;
        }
    });

    // Logout functionality
    logoutLink.addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });

    // Sidebar navigation
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            
            // Update active state
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Initialize modals and buttons
    initializeModals();
});

async function verifyTokenAndLoadApp() {
    try {
        const { user } = await apiService.verifyToken();
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        showAppScreen();
    } catch (error) {
        logout();
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    showLoginScreen();
}

function showLoginScreen() {
    loginScreen.style.display = 'block';
    appScreen.style.display = 'none';
    loginForm.reset();
}

function showAppScreen() {
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    
    // Update UI based on user type
    currentUserName.textContent = currentUser.name;
    
    if (currentUser.type === 'staff') {
        adminOnlyElements.forEach(el => el.style.display = 'none');
    } else {
        adminOnlyElements.forEach(el => el.style.display = 'block');
    }
    
    // Show dashboard by default
    showSection('dashboard');
    
    // Update active sidebar link
    sidebarLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === 'dashboard') {
            link.classList.add('active');
        }
    });
}

function showSection(sectionName) {
    contentSections.forEach(section => {
        section.style.display = 'none';
    });
    
    document.getElementById(sectionName + 'Section').style.display = 'block';
    
    // Refresh section data if needed
    if (sectionName === 'dashboard') {
        loadDashboardData();
    } else if (sectionName === 'tasks') {
        loadTasksTable();
    } else if (sectionName === 'staff') {
        loadStaffTable();
    } else if (sectionName === 'admins') {
        loadAdminsTable();
    } else if (sectionName === 'reports') {
        loadReportsData();
    }
}

function initializeModals() {
    // Task modal
    const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
    document.getElementById('addTaskBtn').addEventListener('click', function() {
        editingTaskId = null;
        document.getElementById('taskModalTitle').textContent = 'Add New Task';
        document.getElementById('taskForm').reset();
        populateGivenToDropdown();
        taskModal.show();
    });

    document.getElementById('saveTaskBtn').addEventListener('click', async function() {
        await saveTask();
        taskModal.hide();
    });

    // Staff modal
    const staffModal = new bootstrap.Modal(document.getElementById('staffModal'));
    document.getElementById('addStaffBtn').addEventListener('click', function() {
        editingStaffId = null;
        document.getElementById('staffModalTitle').textContent = 'Add New Staff';
        document.getElementById('staffForm').reset();
        staffModal.show();
    });

    document.getElementById('saveStaffBtn').addEventListener('click', async function() {
        await saveStaff();
        staffModal.hide();
    });

    // Admin modal
    const adminModal = new bootstrap.Modal(document.getElementById('adminModal'));
    document.getElementById('addAdminBtn').addEventListener('click', function() {
        editingAdminId = null;
        document.getElementById('adminModalTitle').textContent = 'Add New Admin';
        document.getElementById('adminForm').reset();
        adminModal.show();
    });

    document.getElementById('saveAdminBtn').addEventListener('click', async function() {
        await saveAdmin();
        adminModal.hide();
    });

    // Task filters
    document.getElementById('resetFilters').addEventListener('click', function() {
        document.getElementById('searchTask').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterPriority').value = '';
        document.getElementById('filterGivenBy').value = '';
        loadTasksTable();
    });

    document.getElementById('searchTask').addEventListener('input', loadTasksTable);
    document.getElementById('filterStatus').addEventListener('change', loadTasksTable);
    document.getElementById('filterPriority').addEventListener('change', loadTasksTable);
    document.getElementById('filterGivenBy').addEventListener('change', loadTasksTable);
}

async function populateGivenToDropdown() {
    const givenToSelect = document.getElementById('givenTo');
    givenToSelect.innerHTML = '<option value="">Select Staff</option>';
    
    try {
        const users = await apiService.getUsers();
        const staffUsers = users.filter(u => u.type === 'staff');
        staffUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user._id;
            option.textContent = user.name;
            givenToSelect.appendChild(option);
        });

        // Set selected value if editing
        if (editingTaskId) {
            const tasks = await apiService.getTasks();
            const task = tasks.find(t => t._id === editingTaskId);
            if (task) {
                givenToSelect.value = task.givenTo._id;
            }
        }
    } catch (error) {
        showAlert('Failed to load staff list', 'danger');
    }
}

async function loadDashboardData() {
    try {
        const stats = await apiService.getDashboardStats();
        const tasks = await apiService.getTasks();
        
        // Update stats
        document.getElementById('totalTasks').textContent = stats.totalTasks;
        document.getElementById('pendingTasks').textContent = stats.pendingTasks;
        document.getElementById('completedTasks').textContent = stats.completedTasks;
        document.getElementById('completionPercent').textContent = stats.completionPercent + '%';
        
        // Load recent tasks
        const recentTasksTable = document.getElementById('recentTasksTable');
        recentTasksTable.innerHTML = '';
        
        const recentTasks = tasks.slice(0, 5);
        recentTasks.forEach((task, index) => {
            const row = document.createElement('tr');
            row.className = getPriorityClass(task.priority);
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${task.task.substring(0, 50)}${task.task.length > 50 ? '...' : ''}</td>
                <td>${task.givenBy}</td>
                <td>${task.givenTo.name}</td>
                <td>${formatDate(task.targetDate)}</td>
                <td>${task.priority}</td>
                <td><span class="status-${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span></td>
            `;
            
            recentTasksTable.appendChild(row);
        });
        
        // Initialize charts
        initializeCharts(tasks);
    } catch (error) {
        showAlert('Failed to load dashboard data', 'danger');
    }
}

async function loadTasksTable() {
    try {
        const searchTerm = document.getElementById('searchTask').value;
        const statusFilter = document.getElementById('filterStatus').value;
        const priorityFilter = document.getElementById('filterPriority').value;
        const givenByFilter = document.getElementById('filterGivenBy').value;

        const filters = {};
        if (searchTerm) filters.search = searchTerm;
        if (statusFilter) filters.status = statusFilter;
        if (priorityFilter) filters.priority = priorityFilter;
        if (givenByFilter) filters.givenBy = givenByFilter;

        const tasks = await apiService.getTasks(filters);
        const tasksTable = document.getElementById('tasksTable').querySelector('tbody');
        tasksTable.innerHTML = '';
        
        // Populate Given By filter
        const givenBySelect = document.getElementById('filterGivenBy');
        const givenByOptions = [...new Set(tasks.map(t => t.givenBy))];
        givenBySelect.innerHTML = '<option value="">All</option>';
        givenByOptions.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            givenBySelect.appendChild(opt);
        });
        if (givenByFilter) givenBySelect.value = givenByFilter;
        
        // Populate table
        tasks.forEach((task, index) => {
            const row = document.createElement('tr');
            row.className = getPriorityClass(task.priority);
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${task.task}</td>
                <td>${formatDate(task.dateAllocation)}</td>
                <td>${task.givenBy}</td>
                <td>${task.givenTo.name}</td>
                <td>${formatDate(task.targetDate)}</td>
                <td>${task.stepsTaken || ''}</td>
                <td>${formatDate(task.lastUpdated)}</td>
                <td>${formatDate(task.nextUpdate)}</td>
                <td>${task.priority}</td>
                <td><span class="status-${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span></td>
                <td class="action-buttons">
                    ${currentUser.type === 'admin' ? `
                        <button class="btn btn-sm btn-outline-primary edit-task" data-id="${task._id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-task" data-id="${task._id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-outline-primary update-steps" data-id="${task._id}">
                            <i class="fas fa-edit"></i> Update Steps
                        </button>
                    `}
                </td>
            `;
            
            tasksTable.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.edit-task').forEach(btn => {
            btn.addEventListener('click', function() {
                editTask(this.getAttribute('data-id'));
            });
        });
        
        document.querySelectorAll('.delete-task').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteTask(this.getAttribute('data-id'));
            });
        });
        
        document.querySelectorAll('.update-steps').forEach(btn => {
            btn.addEventListener('click', function() {
                updateSteps(this.getAttribute('data-id'));
            });
        });
    } catch (error) {
        showAlert('Failed to load tasks', 'danger');
    }
}

async function loadStaffTable() {
    try {
        const users = await apiService.getUsers();
        const staffTable = document.getElementById('staffTable').querySelector('tbody');
        staffTable.innerHTML = '';
        
        const staffUsers = users.filter(u => u.type === 'staff');
        staffUsers.forEach(user => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${user._id.substring(0, 8)}...</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${user.department || 'N/A'}</td>
                <td>${formatDate(user.dateAdded)}</td>
                <td><span class="status-completed">${user.status}</span></td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary edit-staff" data-id="${user._id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-staff" data-id="${user._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            staffTable.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.edit-staff').forEach(btn => {
            btn.addEventListener('click', function() {
                editStaff(this.getAttribute('data-id'));
            });
        });
        
        document.querySelectorAll('.delete-staff').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteStaff(this.getAttribute('data-id'));
            });
        });
    } catch (error) {
        showAlert('Failed to load staff data', 'danger');
    }
}

async function loadAdminsTable() {
    try {
        const users = await apiService.getUsers();
        const adminsTable = document.getElementById('adminsTable').querySelector('tbody');
        adminsTable.innerHTML = '';
        
        const adminUsers = users.filter(u => u.type === 'admin');
        adminUsers.forEach(user => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${user._id.substring(0, 8)}...</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${formatDate(user.dateAdded)}</td>
                <td><span class="status-completed">${user.status}</span></td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary edit-admin" data-id="${user._id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-admin" data-id="${user._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            adminsTable.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.edit-admin').forEach(btn => {
            btn.addEventListener('click', function() {
                editAdmin(this.getAttribute('data-id'));
            });
        });
        
        document.querySelectorAll('.delete-admin').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteAdmin(this.getAttribute('data-id'));
            });
        });
    } catch (error) {
        showAlert('Failed to load admin data', 'danger');
    }
}

async function loadReportsData() {
    try {
        const tasks = await apiService.getTasks();
        const reportsTable = document.getElementById('reportsTable').querySelector('tbody');
        reportsTable.innerHTML = '';
        
        tasks.forEach((task, index) => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${task.task}</td>
                <td>${task.givenBy}</td>
                <td>${task.givenTo.name}</td>
                <td>${formatDate(task.dateAllocation)}</td>
                <td>${formatDate(task.targetDate)}</td>
                <td>${task.status === 'Completed' ? formatDate(task.lastUpdated) : 'N/A'}</td>
                <td><span class="status-${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span></td>
                <td>${task.priority}</td>
            `;
            
            reportsTable.appendChild(row);
        });
        
        // Initialize report charts
        initializeReportCharts(tasks);
    } catch (error) {
        showAlert('Failed to load reports data', 'danger');
    }
}

async function saveTask() {
    try {
        const taskDetails = document.getElementById('taskDetails').value;
        const givenTo = document.getElementById('givenTo').value;
        const dateAllocation = document.getElementById('dateAllocation').value;
        const targetDate = document.getElementById('targetDate').value;
        const priority = document.getElementById('priority').value;
        const status = document.getElementById('status').value;
        const stepsTaken = document.getElementById('stepsTaken').value;
        const lastUpdated = document.getElementById('lastUpdated').value;
        const nextUpdate = document.getElementById('nextUpdate').value;
        
        const taskData = {
            task: taskDetails,
            givenTo: givenTo,
            dateAllocation: dateAllocation,
            targetDate: targetDate,
            priority: priority,
            status: status,
            stepsTaken: stepsTaken,
            lastUpdated: lastUpdated,
            nextUpdate: nextUpdate
        };

        if (editingTaskId) {
            await apiService.updateTask(editingTaskId, taskData);
            showAlert('Task updated successfully!', 'success');
        } else {
            await apiService.createTask(taskData);
            showAlert('Task created successfully!', 'success');
        }
        
        loadDashboardData();
        loadTasksTable();
    } catch (error) {
        showAlert(error.message || 'Failed to save task', 'danger');
    }
}

async function saveStaff() {
    try {
        const staffName = document.getElementById('staffName').value;
        const staffEmail = document.getElementById('staffEmail').value;
        const staffPhone = document.getElementById('staffPhone').value;
        const staffDepartment = document.getElementById('staffDepartment').value;
        const staffPassword = document.getElementById('staffPassword').value;
        
        const staffData = {
            name: staffName,
            email: staffEmail,
            phone: staffPhone,
            department: staffDepartment,
            password: staffPassword,
            type: 'staff'
        };

        if (editingStaffId) {
            await apiService.updateUser(editingStaffId, staffData);
            showAlert('Staff updated successfully!', 'success');
        } else {
            await apiService.createUser(staffData);
            showAlert('Staff created successfully!', 'success');
        }
        
        loadStaffTable();
    } catch (error) {
        showAlert(error.message || 'Failed to save staff', 'danger');
    }
}

async function saveAdmin() {
    try {
        const adminName = document.getElementById('adminName').value;
        const adminEmail = document.getElementById('adminEmail').value;
        const adminPhone = document.getElementById('adminPhone').value;
        const adminPassword = document.getElementById('adminPassword').value;
        
        const adminData = {
            name: adminName,
            email: adminEmail,
            phone: adminPhone,
            password: adminPassword,
            type: 'admin'
        };

        if (editingAdminId) {
            await apiService.updateUser(editingAdminId, adminData);
            showAlert('Admin updated successfully!', 'success');
        } else {
            await apiService.createUser(adminData);
            showAlert('Admin created successfully!', 'success');
        }
        
        loadAdminsTable();
    } catch (error) {
        showAlert(error.message || 'Failed to save admin', 'danger');
    }
}

async function editTask(id) {
    try {
        const tasks = await apiService.getTasks();
        const task = tasks.find(t => t._id === id);
        if (task) {
            editingTaskId = task._id;
            document.getElementById('taskModalTitle').textContent = 'Edit Task';
            document.getElementById('taskDetails').value = task.task;
            document.getElementById('dateAllocation').value = task.dateAllocation ? task.dateAllocation.split('T')[0] : '';
            document.getElementById('targetDate').value = task.targetDate ? task.targetDate.split('T')[0] : '';
            document.getElementById('priority').value = task.priority;
            document.getElementById('status').value = task.status;
            document.getElementById('stepsTaken').value = task.stepsTaken || '';
            document.getElementById('lastUpdated').value = task.lastUpdated ? task.lastUpdated.split('T')[0] : '';
            document.getElementById('nextUpdate').value = task.nextUpdate ? task.nextUpdate.split('T')[0] : '';
            
            await populateGivenToDropdown();
            
            const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
            taskModal.show();
        }
    } catch (error) {
        showAlert('Failed to load task data', 'danger');
    }
}

async function editStaff(id) {
    try {
        const users = await apiService.getUsers();
        const user = users.find(u => u._id === id && u.type === 'staff');
        if (user) {
            editingStaffId = user._id;
            document.getElementById('staffModalTitle').textContent = 'Edit Staff';
            document.getElementById('staffName').value = user.name;
            document.getElementById('staffEmail').value = user.email;
            document.getElementById('staffPhone').value = user.phone || '';
            document.getElementById('staffDepartment').value = user.department || '';
            document.getElementById('staffPassword').value = '';
            
            const staffModal = new bootstrap.Modal(document.getElementById('staffModal'));
            staffModal.show();
        }
    } catch (error) {
        showAlert('Failed to load staff data', 'danger');
    }
}

async function editAdmin(id) {
    try {
        const users = await apiService.getUsers();
        const user = users.find(u => u._id === id && u.type === 'admin');
        if (user) {
            editingAdminId = user._id;
            document.getElementById('adminModalTitle').textContent = 'Edit Admin';
            document.getElementById('adminName').value = user.name;
            document.getElementById('adminEmail').value = user.email;
            document.getElementById('adminPhone').value = user.phone || '';
            document.getElementById('adminPassword').value = '';
            
            const adminModal = new bootstrap.Modal(document.getElementById('adminModal'));
            adminModal.show();
        }
    } catch (error) {
        showAlert('Failed to load admin data', 'danger');
    }
}

async function deleteTask(id) {
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            await apiService.deleteTask(id);
            showAlert('Task deleted successfully!', 'success');
            loadDashboardData();
            loadTasksTable();
        } catch (error) {
            showAlert(error.message || 'Failed to delete task', 'danger');
        }
    }
}

async function deleteStaff(id) {
    if (confirm('Are you sure you want to delete this staff member?')) {
        try {
            await apiService.deleteUser(id);
            showAlert('Staff deleted successfully!', 'success');
            loadStaffTable();
        } catch (error) {
            showAlert(error.message || 'Failed to delete staff', 'danger');
        }
    }
}

async function deleteAdmin(id) {
    if (confirm('Are you sure you want to delete this admin?')) {
        try {
            await apiService.deleteUser(id);
            showAlert('Admin deleted successfully!', 'success');
            loadAdminsTable();
        } catch (error) {
            showAlert(error.message || 'Failed to delete admin', 'danger');
        }
    }
}

async function updateSteps(id) {
    try {
        const tasks = await apiService.getTasks();
        const task = tasks.find(t => t._id === id);
        if (task) {
            const steps = prompt('Enter steps taken for completion:', task.stepsTaken || '');
            if (steps !== null) {
                const updateData = {
                    stepsTaken: steps,
                    lastUpdated: new Date().toISOString().split('T')[0]
                };
                await apiService.updateTask(id, updateData);
                showAlert('Steps updated successfully!', 'success');
                loadTasksTable();
                loadDashboardData();
            }
        }
    } catch (error) {
        showAlert('Failed to update steps', 'danger');
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function getPriorityClass(priority) {
    switch (priority) {
        case 'High': return 'priority-high';
        case 'Medium': return 'priority-medium';
        case 'Low': return 'priority-low';
        default: return '';
    }
}

function initializeCharts(tasks) {
    // Task Status Chart
    const statusCtx = document.getElementById('taskStatusChart').getContext('2d');
    const statusCounts = {
        'Pending': tasks.filter(t => t.status === 'Pending').length,
        'In Progress': tasks.filter(t => t.status === 'In Progress').length,
        'Completed': tasks.filter(t => t.status === 'Completed').length
    };
    
    new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#ffc107', '#17a2b8', '#28a745']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Priority Chart
    const priorityCtx = document.getElementById('priorityChart').getContext('2d');
    const priorityCounts = {
        'High': tasks.filter(t => t.priority === 'High').length,
        'Medium': tasks.filter(t => t.priority === 'Medium').length,
        'Low': tasks.filter(t => t.priority === 'Low').length
    };
    
    new Chart(priorityCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(priorityCounts),
            datasets: [{
                data: Object.values(priorityCounts),
                backgroundColor: ['#dc3545', '#ffc107', '#28a745']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function initializeReportCharts(tasks) {
    // Completion Trend Chart
    const trendCtx = document.getElementById('completionTrendChart').getContext('2d');
    // This would typically use real historical data
    new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Tasks Completed',
                data: [12, 19, 15, 17, 22, 25],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Staff Performance Chart
    const performanceCtx = document.getElementById('staffPerformanceChart').getContext('2d');
    const staffTasks = {};
    tasks.forEach(task => {
        if (task.givenTo && task.givenTo.name) {
            if (!staffTasks[task.givenTo.name]) {
                staffTasks[task.givenTo.name] = 0;
            }
            if (task.status === 'Completed') {
                staffTasks[task.givenTo.name]++;
            }
        }
    });
    
    new Chart(performanceCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(staffTasks),
            datasets: [{
                label: 'Tasks Completed',
                data: Object.values(staffTasks),
                backgroundColor: '#2ecc71'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function showAlert(message, type) {
    // Remove existing alerts
    const existingAlert = document.querySelector('.alert-message');
    if (existingAlert) {
        existingAlert.remove();
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-message`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);

}

