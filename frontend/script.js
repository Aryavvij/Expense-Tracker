const API_URL = "https://expense-tracker-v5ei.onrender.com"; 

// ===================== INITIAL SETUP ===================== //

function initialSetup() {
  const date = new Date();
  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();

  const monthSelect = document.getElementById("monthSelect");
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

  loadDataForMonth();
}

// ===================== BUDGET SETUP ===================== //

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

// ===================== CATEGORY LOGIC ===================== //

document.getElementById("categoryForm").addEventListener("submit", async (e) => {
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
});

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


// ===================== EXPENSE LOGIC ===================== //

document.getElementById("expenseForm").addEventListener("submit", async (e) => {
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
});

async function deleteExpense(id) {
  if (!confirm("Are you sure you want to delete this expense?")) return;
  try {
    await fetchData(`${API_URL}/expenses/${id}`, null, "DELETE");
    loadDataForMonth();
  } catch (err) {
    console.error("Error deleting expense:", err);
  }
}

// ===================== DATA FETCHING & RENDERING ===================== //

async function fetchData(url, data = null, method = 'GET') {
    const config = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    if (data) {
        config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        let errorBody = await response.text();
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

window.setBudget = setBudget;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.deleteExpense = deleteExpense;

initialSetup();