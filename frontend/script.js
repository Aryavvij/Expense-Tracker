// Set this to your live Render API URL 
const API_URL = "https://expense-tracker-v5ei.onrender.com"; 

console.log("--- SCRIPT LOADED SUCCESSFULLY ---"); 

// ======================================================================
// 1. AUTHENTICATION CORE & HANDLERS 
// ======================================================================

function getToken() {
    return localStorage.getItem('token');
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/index.html'; // LOGOUT -> LOGIN PAGE
}

function setupAuthListeners() {
    if (!document.getElementById('loginForm')) return; 

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const switchButton = document.getElementById('switchButton');

    switchButton.addEventListener('click', () => {
        const isLoginVisible = loginForm.style.display !== 'none';
        
        if (isLoginVisible) {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            document.getElementById('switchText').textContent = "Already have an account? ";
            switchButton.textContent = "Log In here";
        } else {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            document.getElementById('switchText').textContent = "Don't have an account? ";
            switchButton.textContent = "Register here";
        }
    });

    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const messageDisplay = document.getElementById('message');
    messageDisplay.style.display = 'none';

    try {
        const data = await fetchData(`${API_URL}/auth/login`, { email, password }, "POST");
        localStorage.setItem('token', data.token);
        // REDIRECT FIX: Login success goes to Dashboard
        window.location.href = '/dashboard.html'; 
    } catch (err) {
        messageDisplay.textContent = err.message || 'Login failed. Please check your credentials.';
        messageDisplay.style.display = 'block';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const messageDisplay = document.getElementById('registerMessage');
    messageDisplay.style.display = 'none';

    try {
        const data = await fetchData(`${API_URL}/auth/register`, { email, password }, "POST");
        localStorage.setItem('token', data.token);
        // REDIRECT FIX: Register success goes to Dashboard
        window.location.href = '/dashboard.html';
    } catch (err) {
        messageDisplay.textContent = err.message || 'Registration failed.';
        messageDisplay.style.display = 'block';
    }
}

// ======================================================================
// 2. DATA FETCHING & RENDERING FUNCTIONS 
// (All helper functions are defined here)
// ======================================================================

async function fetchData(url, data = null, method = 'GET') {
    const config = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}` 
        }
    };
    if (data) {
        config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        let errorBody = await response.text();

        if (response.status === 401 && window.location.pathname.includes('dashboard.html')) {
            logout(); // Log out and redirect if token is bad on the dashboard
        }
        
        try {
            errorBody = JSON.parse(errorBody);
        } catch(e) { /* ignored */ }
        
        const errorMessage = errorBody.message || errorBody.error || `HTTP Error! Status: ${response.status}`;
        throw new Error(errorMessage);
    }
    return response.status !== 204 ? await response.json() : {};
}

// ... (All other rendering/data functions remain here) ...

async function loadDataForMonth() {
  const monthSelect = document.getElementById("monthSelect");
  const yearSelect = document.getElementById("yearSelect");

  if (!monthSelect || !yearSelect || !monthSelect.value || !yearSelect.value || isNaN(parseInt(monthSelect.value))) {
      console.warn("Month/Year selection not ready. Skipping data load.");
      return; 
  }
  
  try {
    const month = parseInt(monthSelect.value);
    const year = parseInt(yearSelect.value);

    const summary = await fetchData(`${API_URL}/summary?month=${month}&year=${year}`);
    
    const totalBudgetCategory = summary.find(c => c.isBudget) || { limit: 0, spent: 0, _id: null };
    const expenseCategories = summary.filter(c => !c.isBudget);

    updateOverview(totalBudgetCategory, expenseCategories);
    updateCategorySelect(expenseCategories);
    renderCategoryTable(expenseCategories);

    const expenses = await fetchData(`${API_URL}/expenses?month=${month}&year=${year}`);
    renderExpenseTable(expenses);

  } catch (err) {
    console.error("Error loading data:", err);

    updateOverview({ limit: 0, spent: 0, _id: null }, []);
    updateCategorySelect([]);
    renderCategoryTable([]);
    renderExpenseTable([]);
  }
}

function updateOverview(budgetCat, expenseCats) {
  const totalBudget = budgetCat.limit || 0;
  const totalSpent = expenseCats.reduce((sum, c) => sum + c.spent, 0);
  
  document.getElementById("totalBudgetInput").value = totalBudget > 0 ? totalBudget.toFixed(2) : '';
  document.getElementById("totalBudgetDisplay").innerText = totalBudget.toFixed(2);
  document.getElementById("totalSpentDisplay").innerText = totalSpent.toFixed(2);
  document.getElementById("remainingBudgetDisplay").innerText = (totalBudget - totalSpent).toFixed(2);
}

function updateCategorySelect(categories) {
  const select = document.getElementById("categorySelect");
  select.innerHTML = '<option value="" disabled selected>Select Category</option>';
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.name;
    option.textContent = `${cat.name} (Limit: ₹${cat.limit.toFixed(2)})`;
    select.appendChild(option);
  });
}

function renderCategoryTable(categories) {
  const container = document.getElementById("categoryBreakdownList");
  container.innerHTML = "";

  categories.forEach(cat => {
    const div = document.createElement("div");
    div.className = "category-box";
    div.innerHTML = `
      <div class="category-details">
        <strong>${cat.name}</strong><br>
        Spent: ₹${cat.spent.toFixed(2)} / Limit: ₹${cat.limit.toFixed(2)}<br>
        Remaining: ₹${cat.remaining.toFixed(2)}
      </div>
      <div>
        <button class="edit-btn" onclick="editCategory('${cat._id}', '${cat.name}', ${cat.limit})">Edit</button>
        <button class="delete-btn" onclick="deleteCategory('${cat._id}')">Delete</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderExpenseTable(expenses) {
  const tbody = document.getElementById("expenseTableBody");
  tbody.innerHTML = "";

  expenses.forEach(exp => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(exp.date).toLocaleDateString()}</td>
      <td>${exp.category}</td>
      <td>₹${exp.amount.toFixed(2)}</td>
      <td>${exp.note || "-"}</td>
      <td>
        <button class="delete-btn" onclick="deleteExpense('${exp._id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ======================================================================
// 3. BUDGET, CATEGORY, EXPENSE HANDLERS 
// (All handler definitions are here)
// ======================================================================

async function setBudget() {
  console.log("--- setBudget function called ---"); 
  
  const month = parseInt(document.getElementById("monthSelect").value);
  const year = parseInt(document.getElementById("yearSelect").value);
  const budgetInput = document.getElementById("totalBudgetInput");
  const totalBudget = parseFloat(budgetInput.value) || 0;

  try {
    const summary = await fetchData(`${API_URL}/summary?month=${month}&year=${year}`);
    const budgetCategory = summary.find(c => c.isBudget);

    if (budgetCategory) {
      await fetchData(`${API_URL}/categories/${budgetCategory._id}`, { limit: totalBudget, name: 'Total Budget' }, "PUT");
    } else {
      await fetchData(`${API_URL}/categories`, {
        name: 'Total Budget', 
        limit: totalBudget, 
        month, 
        year, 
        isBudget: true
      }, "POST");
    }
    
    budgetInput.value = "";
    loadDataForMonth();
  } catch (err) {
    console.error("Error setting budget:", err);
    alert("Failed to set budget: " + err.message);
  }
}

async function handleCategorySubmit(e) {
    e.preventDefault();

    const month = parseInt(document.getElementById("monthSelect").value);
    const year = parseInt(document.getElementById("yearSelect").value);
    const name = document.getElementById("categoryName").value.trim();
    const limit = parseFloat(document.getElementById("categoryLimit").value) || 0;

    if (name && limit > 0) {
        try {
        await fetchData(`${API_URL}/categories`, { name, limit, month, year }, "POST");
        document.getElementById("categoryForm").reset();
        loadDataForMonth();
        } catch (err) {
        console.error("Error adding category:", err);
        alert(err.message || "Failed to add category.");
        }
    }
}

async function editCategory(id, currentName, currentLimit) {
    const newName = prompt("Enter new category name:", currentName);
    if (newName === null) return; 

    let newLimit = prompt("Enter new budget limit:", currentLimit);
    if (newLimit === null) return; 

    newLimit = parseFloat(newLimit);

    if (newName.trim() === "" || isNaN(newLimit) || newLimit < 0) {
        alert("Invalid input for name or limit.");
        return;
    }

    try {
        await fetchData(`${API_URL}/categories/${id}`, { name: newName.trim(), limit: newLimit }, "PUT");
        loadDataForMonth();
    } catch (err) {
        console.error("Error editing category:", err);
        alert("Failed to edit category.");
    }
}

async function deleteCategory(id) {
    if (!confirm("Are you sure you want to delete this category? (Budget categories will be reset to 0)")) return;

    try {
        await fetchData(`${API_URL}/categories/${id}`, null, "DELETE");
        loadDataForMonth();
    } catch (err) {
        console.error("Error deleting category:", err);
        alert("Failed to delete category: " + err.message);
    }
}

async function handleExpenseSubmit(e) {
    e.preventDefault();

    const date = document.getElementById("date").value;
    const category = document.getElementById("categorySelect").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const note = document.getElementById("note").value;

    if (category && amount > 0) {
        try {
        await fetchData(`${API_URL}/expenses`, { date, category, amount, note }, "POST");
        document.getElementById("expenseForm").reset();
        loadDataForMonth();
        } catch (err) {
        console.error("Error adding expense:", err);
        alert("Failed to add expense.");
        }
    }
}

async function deleteExpense(id) {
  if (!confirm("Are you sure you want to delete this expense?")) return;
  try {
    await fetchData(`${API_URL}/expenses/${id}`, null, "DELETE");
    loadDataForMonth();
  } catch (err) {
    console.error("Error deleting expense:", err);
  }
}


// ===================== 4. INITIAL SETUP (The final definition that uses all the above functions) ===================== 

function initialSetup() {
  const monthSelect = document.getElementById("monthSelect");
  
  if (!monthSelect) {
      return; 
  }

  console.log("TRACE 1: Initial setup starting."); 

  const date = new Date();
  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();

  const yearSelect = document.getElementById("yearSelect");
  
  if (!yearSelect) {
      console.error("TRACE ERROR: yearSelect element not found.");
      return; 
  }

  // Populate months
  for (let i = 0; i < 12; i++) {
    const monthName = new Date(null, i, 1).toLocaleString('en-US', { month: 'long' });
    const option = document.createElement("option");
    option.value = i;
    option.textContent = monthName;
    monthSelect.appendChild(option);
    if (i === currentMonth) option.selected = true;
  }

  // Populate years
  const startYear = currentYear - 1;
  const endYear = 2029; 
  
  for (let y = startYear; y <= endYear; y++) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    yearSelect.appendChild(option);
  }

  console.log("TRACE 2: Month/Year dropdowns populated."); 

  // Attach Month/Year change listeners
  monthSelect.addEventListener('change', loadDataForMonth);
  yearSelect.addEventListener('change', loadDataForMonth);

  // 1. Set Budget Button (attached by ID now - Requires id="setBudgetButton" in index.html)
  const setBudgetButton = document.getElementById("setBudgetButton");
  if (setBudgetButton) {
      setBudgetButton.addEventListener("click", setBudget);
      console.log("TRACE 3: Set Budget listener attached."); 
  }
  
  // 2. Category Form Submit
  document.getElementById("categoryForm").addEventListener("submit", handleCategorySubmit); 
  
  // 3. Expense Form Submit
  document.getElementById("expenseForm").addEventListener("submit", handleExpenseSubmit); 
  
  console.log("TRACE 4: All form listeners attached successfully."); // <-- FINAL SUCCESS TRACE

  loadDataForMonth();
}

// ===================== 5. EXPOSE FUNCTIONS & INITIALIZE ===================== 

// ... (all functions above checkAuth remain the same) ...

function checkAuth() {
  const token = getToken();
  
  // Check if the current page is the dashboard (the tracker UI)
  if (window.location.pathname.includes('dashboard.html')) {
      if (!token) {
        // If no token on dashboard, send to login page
        window.location.href = '/index.html';
      } else {
          initialSetup();
      }
  } 
  // Check if the current page is the login page (index.html or the root path '/')
  else {
      if (token) {
        // If token exists, send to dashboard.
        window.location.href = '/dashboard.html';
      } else {
          // No token? Stay on login page and set up forms.
          setupAuthListeners();
      }
  }
}

// ... (rest of the script remains the same) ...

// Expose functions globally 
window.setBudget = setBudget;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.deleteExpense = deleteExpense;
window.logout = logout; 
window.handleCategorySubmit = handleCategorySubmit; 
window.handleExpenseSubmit = handleExpenseSubmit; 

document.addEventListener('DOMContentLoaded', checkAuth);