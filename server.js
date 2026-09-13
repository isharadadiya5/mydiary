const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { dbRun, dbGet, dbAll } = require('./db');
const { encrypt, decrypt } = require('./crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mydiary_super_secret_jwt_key_2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' })); // Support base64 photo attachments

// Static web server to serve frontend index.html
app.use(express.static(__dirname));

// Rate limiting to prevent brute-force attacks on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per windowMs
  message: { error: 'Too many login/registration attempts. Please try again in 15 minutes.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
    }
    req.user = user; // { id, username, email }
    next();
  });
}

/* ==========================================================================
   AUTHENTICATION ROUTES
   ========================================================================== */

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if username or email already exists
    const existing = await dbGet(`SELECT id FROM users WHERE username = ? OR email = ?`, [username, email]);
    if (existing) {
      return res.status(400).json({ error: 'Username or email is already registered.' });
    }

    // Hash password securely with bcrypt
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Save user to database
    const result = await dbRun(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
      [username.trim(), email.trim().toLowerCase(), password_hash]
    );

    const user = { id: result.lastID, username, email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ message: 'User registered successfully', token, user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or username

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    // Find user by username or email
    const userRow = await dbGet(
      `SELECT * FROM users WHERE username = ? OR email = ?`,
      [identifier.trim(), identifier.trim().toLowerCase()]
    );

    if (!userRow) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Verify hashed password
    const validPassword = await bcrypt.compare(password, userRow.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = { id: userRow.id, username: userRow.username, email: userRow.email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Login successful', token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Get Current Logged-in User Profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

/* ==========================================================================
   JOURNAL ENTRIES ROUTES (AES-256 Encrypted in DB)
   ========================================================================== */

// Get all entries for authenticated user
app.get('/api/entries', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC, id DESC`,
      [req.user.id]
    );

    // Decrypt sensitive body text before returning to client
    const decryptedEntries = rows.map(e => ({
      ...e,
      body: decrypt(e.body)
    }));

    res.json({ entries: decryptedEntries });
  } catch (err) {
    console.error('Fetch entries error:', err);
    res.status(500).json({ error: 'Failed to retrieve journal entries.' });
  }
});

// Create new entry
app.post('/api/entries', authenticateToken, async (req, res) => {
  try {
    const { date, title, mood, tags, body, photo, audio } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Entry body text is required.' });
    }

    const dateStr = date || new Date().toISOString().slice(0, 10);
    const titleStr = title ? title.trim() : 'Untitled Day';
    const moodStr = mood || '😊 Happy';
    const encryptedBody = encrypt(body.trim());

    const result = await dbRun(
      `INSERT INTO entries (user_id, date, title, mood, tags, body, photo, audio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, dateStr, titleStr, moodStr, tags || '', encryptedBody, photo || '', audio || '']
    );

    const newEntry = {
      id: result.lastID,
      user_id: req.user.id,
      date: dateStr,
      title: titleStr,
      mood: moodStr,
      tags: tags || '',
      body: body.trim(),
      photo: photo || '',
      audio: audio || ''
    };

    res.status(201).json({ message: 'Entry saved securely', entry: newEntry });
  } catch (err) {
    console.error('Save entry error:', err);
    res.status(500).json({ error: 'Failed to save journal entry.' });
  }
});

// Update existing entry
app.put('/api/entries/:id', authenticateToken, async (req, res) => {
  try {
    const entryId = req.params.id;
    const { title, mood, tags, body, photo, audio } = req.body;

    // Verify ownership
    const existing = await dbGet(`SELECT id FROM entries WHERE id = ? AND user_id = ?`, [entryId, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Entry not found or access denied.' });
    }

    const encryptedBody = encrypt(body.trim());

    await dbRun(
      `UPDATE entries SET title = ?, mood = ?, tags = ?, body = ?, photo = ?, audio = ? WHERE id = ? AND user_id = ?`,
      [title ? title.trim() : 'Untitled Day', mood, tags || '', encryptedBody, photo || '', audio || '', entryId, req.user.id]
    );

    res.json({ message: 'Entry updated successfully' });
  } catch (err) {
    console.error('Update entry error:', err);
    res.status(500).json({ error: 'Failed to update entry.' });
  }
});

// Delete entry
app.delete('/api/entries/:id', authenticateToken, async (req, res) => {
  try {
    const entryId = req.params.id;
    const result = await dbRun(`DELETE FROM entries WHERE id = ? AND user_id = ?`, [entryId, req.user.id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Entry not found or access denied.' });
    }

    res.json({ message: 'Entry deleted successfully' });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
});

/* ==========================================================================
   GRATITUDE ROUTES
   ========================================================================== */

app.get('/api/gratitude', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll(`SELECT * FROM gratitude WHERE user_id = ? ORDER BY date DESC`, [req.user.id]);
    res.json({ gratitude: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gratitude records.' });
  }
});

app.post('/api/gratitude', authenticateToken, async (req, res) => {
  try {
    const { date, item1, item2, item3 } = req.body;
    const dateStr = date || new Date().toISOString().slice(0, 10);
    const result = await dbRun(
      `INSERT INTO gratitude (user_id, date, item1, item2, item3) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, dateStr, item1 || '', item2 || '', item3 || '']
    );
    res.status(201).json({ gratitude: { id: result.lastID, user_id: req.user.id, date: dateStr, item1, item2, item3 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save gratitude log.' });
  }
});

/* ==========================================================================
   FUTURE LETTERS ROUTES (AES-256 Encrypted)
   ========================================================================== */

app.get('/api/letters', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll(`SELECT * FROM letters WHERE user_id = ? ORDER BY date ASC`, [req.user.id]);
    const decrypted = rows.map(l => ({ ...l, body: decrypt(l.body) }));
    res.json({ letters: decrypted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch letters.' });
  }
});

app.post('/api/letters', authenticateToken, async (req, res) => {
  try {
    const { date, body } = req.body;
    if (!body || !date) return res.status(400).json({ error: 'Date and body text are required.' });

    const encryptedBody = encrypt(body.trim());
    const result = await dbRun(`INSERT INTO letters (user_id, date, body) VALUES (?, ?, ?)`, [req.user.id, date, encryptedBody]);

    res.status(201).json({ message: 'Letter sealed securely', letter: { id: result.lastID, user_id: req.user.id, date, body: body.trim() } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save letter.' });
  }
});

/* ==========================================================================
   GOALS ROUTES
   ========================================================================== */

app.get('/api/goals', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll(`SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC`, [req.user.id]);
    res.json({ goals: rows.map(g => ({ ...g, done: Boolean(g.done) })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch goals.' });
  }
});

app.post('/api/goals', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Goal text is required.' });

    const result = await dbRun(`INSERT INTO goals (user_id, text, done) VALUES (?, ?, 0)`, [req.user.id, text.trim()]);
    res.status(201).json({ goal: { id: result.lastID, user_id: req.user.id, text: text.trim(), done: false } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save goal.' });
  }
});

app.put('/api/goals/:id', authenticateToken, async (req, res) => {
  try {
    const { done } = req.body;
    await dbRun(`UPDATE goals SET done = ? WHERE id = ? AND user_id = ?`, [done ? 1 : 0, req.params.id, req.user.id]);
    res.json({ message: 'Goal status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update goal.' });
  }
});

// Serve frontend for all unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🔒 MyDiary Secure Backend & Database is Running!`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
