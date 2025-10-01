// Set this to your live Render API URL if you are testing the deployed site, 
// or http://127.0.0.1:3001 if you are testing locally.
const API_URL = "https://expense-tracker-v5ei.onrender.com"; 

// ======================================================================
//                              AUTHENTICATION CORE
// ======================================================================

function getToken() {
    // Get the stored token
    return localStorage.getItem('token');
}

function checkAuth() {
    const token = getToken();
    
    // Check if the current page is the main tracker page
    if (window.location.pathname.includes('index.html')) {
        if (!token) {
            // If on the main app page but no token, redirect to login
            window.location.href = 'http://127.0.0.1:5501/auth.html';
        } else {
            // If token exists, proceed to load financial data
            initialSetup();
        }
    } 
    // Check if the current page is the authentication page
    else if (window.location.pathname.includes('auth.html')) {
        if (token) {
            // If token exists, redirect straight to the main app
            window.location.href = 'http://127.0.0.1:5501/index.html';
        } else {
            // Set up form listeners if no token is found
            setupAuthListeners();
        }
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'http://127.0.0.1:5501/auth.html';
}

function setupAuthListeners() {
    // Check if we are actually on auth.html before setting listeners
    if (!document.getElementById('loginForm')) return; 

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const switchButton = document.getElementById('switchButton');

    // Handle form switching
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
    messageDisplay.style.display = 'none'; // Clear previous errors

    try {
        const data = await fetchData(`${API_URL}/auth/login`, { email, password }, "POST");
        localStorage.setItem('token', data.token);
        window.location.href = 'http://127.0.0.1:5501/index.html';
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
    messageDisplay.style.display = 'none'; // Clear previous errors

    try {
        const data = await fetchData(`${API_URL}/auth/register`, { email, password }, "POST");
        localStorage.setItem('token', data.token);
        window.location.href = 'http://127.0.0.1:5501/index.html';
    } catch (err) {
        messageDisplay.textContent = err.message || 'Registration failed.';
        messageDisplay.style.display = 'block';
    }
}

// ===================== INITIAL SETUP (financial data loading) ===================== 

function initialSetup() {
  // CRITICAL FIX: If the main element (Month Select) isn't here, stop executing main app code.
  const monthSelect = document.getElementById("monthSelect");
  
  if (!monthSelect) {
      return; 
  }

  const date = new Date();
  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();

  const yearSelect = document.getElementById("yearSelect");

 
  for (let i = 0; i < 12; i++) {
    const monthName = new Date(null, i, 1).toLocaleString('en-US', { month: 'long' });
    const option = document.createElement("option");
    option.value = i;
    option.textContent = monthName;
    if (i === currentMonth) option.selected = true;
    monthSelect.appendChild(option);
  }

  
  const startYear = currentYear - 1;
  const endYear = 2029; 
  
  for (let y = startYear; y <= endYear; y++) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    yearSelect.appendChild(option);
  }


  monthSelect.addEventListener('change', loadDataForMonth);
  yearSelect.addEventListener('change', loadDataForMonth);

  // FIX: Move the main form listeners inside initialSetup to ensure they are attached ONLY on index.html
  document.getElementById("categoryForm").addEventListener("submit", handleCategorySubmit); 
  document.getElementById("expenseForm").addEventListener("submit", handleExpenseSubmit); 
  // END FIX

  loadDataForMonth();
}

// ===================== BUDGET SETUP ===================== 
// ... (Your existing setBudget function remains here) ...
async function setBudget() {
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


// ===================== CATEGORY LOGIC ===================== 
// Note: These handlers were likely defined globally before. 
// We are moving the listener attachment into initialSetup, but keeping the functions global.

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


// ===================== EXPENSE LOGIC ===================== 

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

// ===================== DATA FETCHING & RENDERING ===================== 

// IMPORTANT: Updated fetchData to automatically include the JWT token
async function fetchData(url, data = null, method = 'GET') {
    const config = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            // ADDED: Include the JWT token in the Authorization header
            'Authorization': `Bearer ${getToken()}` 
        }
    };
    if (data) {
        config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        let errorBody = await response.text();

        // ADDED: If the token is invalid/expired, log the user out
        if (response.status === 401 && !window.location.pathname.includes('auth.html')) {
            logout(); // Log out and redirect
        }
        
        try {
            errorBody = JSON.parse(errorBody);
        } catch(e) { /* ignored */ }
        
        const errorMessage = errorBody.message || errorBody.error || `HTTP Error! Status: ${response.status}`;
        throw new Error(errorMessage);
    }
    return response.status !== 204 ? await response.json() : {};
}

async function loadDataForMonth() {
  try {
    const month = parseInt(document.getElementById("monthSelect").value);
    const year = parseInt(document.getElementById("yearSelect").value);
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

// Expose functions globally (optional, but good practice for inline HTML)
window.setBudget = setBudget;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.deleteExpense = deleteExpense;
window.logout = logout; 

// Expose the new event handlers globally so initialSetup can reference them
window.handleCategorySubmit = handleCategorySubmit; 
window.handleExpenseSubmit = handleExpenseSubmit; 

// ===================== INITIALIZE ===================== 
// Ensure the DOM is fully loaded before checking for forms and setting listeners
document.addEventListener('DOMContentLoaded', checkAuth);