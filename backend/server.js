const express = require('express'); 
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const jwt = require('jsonwebtoken'); // Import for token handling

const app = express();
// V1.1: Forcing Redeploy
const port = process.env.PORT || 3001;


// --- Middleware ---
app.use(cors()); 
app.use(express.json());

// --- MongoDB Connection ---
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

// --- Models & Routers ---
const Category = require('./models/category.model'); 
const Expense = require('./models/expense.model'); 
const User = require('./models/user.model'); // NEW: Import the User model
const authRouter = require('./auth');      // NEW: Import the authentication router

// ===================== AUTHENTICATION SETUP =====================
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secure_jwt_secret'; 

// Middleware to protect routes and extract userId
function protect(req, res, next) {
    // 1. Check for token in headers
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization token missing or invalid.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Verify token and extract payload
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 3. Attach userId to the request object
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

// Attach the authentication routes
app.use('/auth', authRouter);

// ===================== HELPER FUNCTION ===================== //

function getDateRange(month, year) {
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    if (isNaN(monthNum) || isNaN(yearNum)) throw new Error("Invalid month or year");
    
    const startOfMonth = new Date(yearNum, monthNum, 1);
    const endOfMonth = new Date(yearNum, monthNum + 1, 1);
    
    return { startOfMonth, endOfMonth };
}

// ==================================================================================
// PROTECTED ENDPOINTS: APPLY 'protect' MIDDLEWARE AND FILTER BY 'req.userId'
// ==================================================================================

// ===================== CATEGORY & BUDGET ENDPOINTS ===================== //

app.get('/summary', protect, async (req, res) => {
  try {
    const { month, year } = req.query;
    const { startOfMonth, endOfMonth } = getDateRange(month, year);
    
    // FILTERED: Only fetch categories belonging to the logged-in user (req.userId)
    const categories = await Category.find({ month, year, userId: req.userId });
    
    // FILTERED: Only fetch expenses belonging to the logged-in user
    const expenses = await Expense.find({ 
        date: { $gte: startOfMonth, $lt: endOfMonth },
        userId: req.userId 
    });
    
    const summary = categories.map(cat => {
      const spent = expenses
        .filter(exp => exp.category === cat.name)
        .reduce((sum, e) => sum + e.amount, 0);
      
      return {
        _id: cat._id,
        name: cat.name,
        limit: cat.limit,
        isBudget: cat.isBudget,
        spent: spent,
        remaining: cat.limit - spent
      };
    });

    res.json(summary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/categories', protect, async (req, res) => {
  try {
    const { name, limit, month, year, isBudget } = req.body;
    
    if (!isBudget) {
      // FILTERED: Check for duplicate category only for the current user
      const existing = await Category.findOne({ name, month, year, isBudget: false, userId: req.userId });
      if (existing) {
          return res.status(409).json({ message: "Category already exists for this month/year for this user." });
      }
    }
    
    // ADDED: Include the userId in the new document
    const newCategory = new Category({ 
        name, 
        limit, 
        month, 
        year, 
        isBudget: isBudget || false,
        userId: req.userId // SAVING THE USER ID
    });
    await newCategory.save();
    res.json({ message: "Category added" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/categories/:id', protect, async (req, res) => {
    try {
        const { limit, name } = req.body;
        
        // FILTERED: Ensure the user only updates categories belonging to them
        const updatedCategory = await Category.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { limit, name }, 
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ message: "Category not found or does not belong to you." });
        }
        res.json(updatedCategory);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE: Delete a category
app.delete('/categories/:id', protect, async (req, res) => {
  try {
    // FILTERED: Find the category by ID AND userId
    const category = await Category.findOne({ _id: req.params.id, userId: req.userId });

    if (!category) {
        return res.status(404).json({ message: "Category not found or does not belong to you." });
    }
    
    if (category.isBudget) {
        // If it's a budget, just reset the limit to 0
        await Category.findByIdAndUpdate(req.params.id, { limit: 0 }, { new: true });
        return res.json({ message: "Total Budget reset to 0." });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===================== EXPENSE ENDPOINTS ===================== //

app.get('/expenses', protect, async (req, res) => {
  try {
    const { month, year } = req.query;
    const { startOfMonth, endOfMonth } = getDateRange(month, year);

    // FILTERED: Only fetch expenses belonging to the logged-in user
    const expenses = await Expense.find({ 
        date: { $gte: startOfMonth, $lt: endOfMonth },
        userId: req.userId
    }).sort({ date: -1 });
    
    res.json(expenses);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/expenses', protect, async (req, res) => {
  try {
    const { date, category, amount, note } = req.body;
    
    // ADDED: Include the userId in the new document
    const newExpense = new Expense({ 
        date, 
        category, 
        amount, 
        note, 
        userId: req.userId // SAVING THE USER ID
    });
    
    await newExpense.save();
    res.json({ message: "Expense added" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/expenses/:id', protect, async (req, res) => {
  try {
    // FILTERED: Ensure the user only deletes expenses belonging to them
    const result = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    
    if (!result) {
        return res.status(404).json({ message: "Expense not found or does not belong to you." });
    }
    
    res.json({ message: "Expense deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});