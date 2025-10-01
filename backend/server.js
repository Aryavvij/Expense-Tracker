const express = require('express'); 
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001; 

app.use(cors()); 
app.use(express.json());
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

const Category = require('./models/category.model'); 
const Expense = require('./models/expense.model'); 


// ===================== HELPER FUNCTION ===================== //

function getDateRange(month, year) {
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    if (isNaN(monthNum) || isNaN(yearNum)) throw new Error("Invalid month or year");
    
    const startOfMonth = new Date(yearNum, monthNum, 1);
    const endOfMonth = new Date(yearNum, monthNum + 1, 1);
    
    return { startOfMonth, endOfMonth };
}

// ===================== CATEGORY & BUDGET ENDPOINTS ===================== //

app.get('/summary', async (req, res) => {
  try {
    const { month, year } = req.query;
    const { startOfMonth, endOfMonth } = getDateRange(month, year);

    const categories = await Category.find({ month, year });
    const expenses = await Expense.find({ date: { $gte: startOfMonth, $lt: endOfMonth } });
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

app.post('/categories', async (req, res) => {
  try {
    const { name, limit, month, year, isBudget } = req.body;
    if (!isBudget) {
      const existing = await Category.findOne({ name, month, year, isBudget: false });
      if (existing) {
          return res.status(409).json({ message: "Category already exists for this month/year." });
      }
    }
    
    const newCategory = new Category({ name, limit, month, year, isBudget: isBudget || false });
    await newCategory.save();
    res.json({ message: "Category added" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/categories/:id', async (req, res) => {
    try {
        const { limit, name } = req.body;
        
        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            { limit, name }, 
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ message: "Category not found in DB." });
        }
        res.json(updatedCategory);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE: Delete a category
app.delete('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
        return res.status(404).json({ message: "Category not found." });
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

app.get('/expenses', async (req, res) => {
  try {
    const { month, year } = req.query;
    const { startOfMonth, endOfMonth } = getDateRange(month, year);

    const expenses = await Expense.find({ date: { $gte: startOfMonth, $lt: endOfMonth } }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/expenses', async (req, res) => {
  try {
    const { date, category, amount, note } = req.body;
    
    const newExpense = new Expense({ date, category, amount, note });
    await newExpense.save();
    res.json({ message: "Expense added" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/expenses/:id', async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: "Expense deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});