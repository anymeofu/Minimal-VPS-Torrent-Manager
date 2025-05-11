const express = require('express');
const router = express.Router();

// --- !!! IMPORTANT SECURITY WARNING !!! ---
// These are placeholder credentials. 
// In a real application, NEVER hardcode credentials like this.
// Use environment variables, a config file outside version control, or a proper user database with hashed passwords.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123'; 
// --- End Security Warning ---

module.exports = function(db) { // db might be used later if users are stored in DB

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const { username, password, rememberMe } = req.body; // rememberMe is now received

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.userId = 'admin_user_id'; 
      req.session.username = ADMIN_USERNAME;

      if (rememberMe) {
        // Extend cookie maxAge if "Keep me logged in" is checked
        // Default is 1 day (from src/index.js), extend to 30 days
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        req.session.cookie.maxAge = thirtyDays;
      }
      // If not rememberMe, session will use default maxAge from initial session config

      res.json({ message: 'Login successful.', username: ADMIN_USERNAME });
    } else {
      res.status(401).json({ error: 'Invalid username or password.' });
    }
  });

  // GET /api/auth/status
  router.get('/status', (req, res) => {
    if (req.session && req.session.userId) {
      res.json({ isAuthenticated: true, username: req.session.username });
    } else {
      res.json({ isAuthenticated: false });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({ error: 'Could not log out, please try again.' });
      }
      res.clearCookie('connect.sid'); // Default session cookie name, adjust if changed
      res.json({ message: 'Logout successful.' });
    });
  });

  return router;
};
