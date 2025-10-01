const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  limit: { type: Number, required: true, default: 0 },
  isBudget: { type: Boolean, default: false }, 
  month: { type: Number, required: true, min: 0, max: 11 },
  year: { type: Number, required: true },
  // NEW: Link to the User
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } 
}, { timestamps: true });

// Ensure unique categories per month/year/USER
categorySchema.index({ name: 1, month: 1, year: 1, userId: 1 }, { unique: true }); 

module.exports = mongoose.model('Category', categorySchema);