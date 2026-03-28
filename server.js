// ============================================================
//  Planet Playground — Node.js / Express + MongoDB
//  Run:  node server.js
// ============================================================

require('dotenv').config();
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const path    = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'planet_playground_secret_2025';
const MONGO_URI  = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/planetplayground';

// ─────────────────────────────────────────────
//  MONGODB CONNECTION
// ─────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ─────────────────────────────────────────────
//  MONGOOSE MODELS
// ─────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  ecoPoints: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  claimedDays: { type: [Number], default: [] },
  badges: { type: [String], default: [] },
  lastLoginDate: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const scoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quizType: String,
  score: Number,
  total: Number,
  pointsEarned: Number,
  createdAt: { type: Date, default: Date.now }
});
const Score = mongoose.model('Score', scoreSchema);

// ─────────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─────────────────────────────────────────────
//  AUTH ROUTES
// ─────────────────────────────────────────────

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashed,
      lastLoginDate: new Date().toISOString().slice(0, 10)
    });
    await user.save();

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, message: 'Account created!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password' });

    // Update streak
    const today = new Date().toISOString().slice(0, 10);
    if (user.lastLoginDate !== today) {
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      user.streak = user.lastLoginDate === yesterday ? (user.streak || 0) + 1 : 1;
      user.lastLoginDate = today;
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, message: 'Logged in!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  USER PROFILE
// ─────────────────────────────────────────────

// GET /api/user
app.get('/api/user', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  DAILY REWARD
// ─────────────────────────────────────────────

// POST /api/reward/claim
app.post('/api/reward/claim', authMiddleware, async (req, res) => {
  try {
    const { dayNumber, points } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.claimedDays.includes(dayNumber))
      return res.status(400).json({ error: 'Day already claimed' });

    user.claimedDays.push(dayNumber);
    user.ecoPoints += (points || 0);
    await user.save();

    res.json({ success: true, ecoPoints: user.ecoPoints, claimedDays: user.claimedDays });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  REDEEM
// ─────────────────────────────────────────────

// POST /api/redeem
app.post('/api/redeem', authMiddleware, async (req, res) => {
  try {
    const { rewardName, cost } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.ecoPoints < cost)
      return res.status(400).json({ error: 'Not enough Eco Points' });

    user.ecoPoints -= cost;
    user.badges.push(rewardName); // Optional: add as a badge/item
    await user.save();

    res.json({ success: true, ecoPoints: user.ecoPoints });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  QUIZ SCORE
// ─────────────────────────────────────────────

// POST /api/quizScore
app.post('/api/quizScore', authMiddleware, async (req, res) => {
  try {
    const { quizType, score, total, pointsEarned } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.ecoPoints += (pointsEarned || 0);
    await user.save();

    const scoreEntry = new Score({
      userId: user._id, quizType, score, total, pointsEarned
    });
    await scoreEntry.save();

    res.json({ success: true, ecoPoints: user.ecoPoints });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  LEADERBOARD
// ─────────────────────────────────────────────

// GET /api/leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const top = await User.find()
      .select('name ecoPoints streak badges')
      .sort({ ecoPoints: -1 })
      .limit(10);
    res.json(top);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  SERVE INDEX
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'SIH.html'));
});

// ─────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('🌱 ═══════════════════════════════════════════');
  console.log('   Planet Playground Server Started!');
  console.log('═══════════════════════════════════════════════');
  console.log(`🚀  URL    : http://localhost:${PORT}/SIH.html`);
  console.log(`💾  DB     : MongoDB Connected`);
  console.log(`🔑  Auth   : JWT (30-day tokens)`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
});
