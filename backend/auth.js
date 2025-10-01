const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./models/user.model');
const express = require('express');
const router = express.Router(); 

// IMPORTANT: Add this line to your .env file or production environment variables!
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secure_jwt_secret'; 
const SALT_ROUNDS = 10;

// ======================= REGISTER =======================
router.post('/register', async (req, res) => { 
  try {
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
      return res.status(400).json({ message: 'Please provide a valid email and a password of at least 6 characters.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({ 
      message: 'Registration successful!',
      token,
      email: newUser.email
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ======================= LOGIN =======================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Login successful!',
      token,
      email: user.email
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

module.exports = router;