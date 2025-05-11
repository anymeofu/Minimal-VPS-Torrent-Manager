require('dotenv').config(); // Load .env file contents into process.env

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001; 
const cookieParser = require('cookie-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
// const rateLimit = require('express-rate-limit'); // Removed

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(cookieParser());

const sessionDbPath = path.join(__dirname, 'db'); // Store session DB in the same directory as main DB

app.use(session({
  store: new SQLiteStore({
    dir: sessionDbPath, // Directory to store the session database file
    db: 'sessions.sqlite', // Name of the session database file
    table: 'sessions',      // Name of the table within the session database
    concurrentDB: true      // Allows multiple connections, useful with main DB potentially
  }),
  secret: process.env.SESSION_SECRET || 'your_very_secret_key_for_vps_torrent_manager_CHANGE_ME_PLEASE', 
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    httpOnly: true, 
    maxAge: 24 * 60 * 60 * 1000 // Default 1 day, can be overridden by rememberMe
  } 
}));

// Rate limiting removed

// Public file serving route (for webseeds, etc.) - must be before auth middleware for /api
const publicFilesRouter = require('./routes/publicFilesRouter');
app.use('/serve_file', publicFilesRouter);


// Database setup
const fs = require('fs');
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`Created database directory: ${dbDir}`);
}
const dbPath = path.join(dbDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    // Create tables if they don't exist
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        filePath TEXT,
        status TEXT DEFAULT 'pending', -- pending, downloading, completed, error, extracting
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        extractedPath TEXT,
        totalBytes INTEGER DEFAULT 0,
        downloadedBytes INTEGER DEFAULT 0
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS torrents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filePath TEXT NOT NULL, -- path to the .torrent file
        sourcePath TEXT NOT NULL, -- path to the source file/folder
        webseeds TEXT, -- JSON array of webseed URLs
        isPrivate BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        retentionHours INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS media_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filePath TEXT NOT NULL UNIQUE,
        imdbId TEXT,
        title TEXT,
        year INTEGER,
        posterUrl TEXT,
        retentionHours INTEGER,
        deleteAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    });
  }
});

// API Routes
// Note: db is initialized above and is available in this scope.
const filesRouter = require('./routes/files')(db); // Pass db instance
app.use('/api/files', filesRouter);

const downloadsRouter = require('./routes/downloads')(db); // Pass db instance
app.use('/api/downloads', downloadsRouter);

const torrentsRouter = require('./routes/torrents')(db); // Pass db instance
app.use('/api/torrents', torrentsRouter);

const mediaRouter = require('./routes/media')(db);
app.use('/api/media', mediaRouter);

// Auth routes (public)
const authRouter = require('./routes/auth')(db); // Will create this file next
app.use('/api/auth', authRouter);

// Authentication middleware for all other API routes
app.use('/api', (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ error: 'Not authenticated' });
  }
});

// Protected API routes continue here (they are already defined above, this middleware will apply to them)

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Auto-delete background job removed

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = { app }; // Only export app, as db is passed directly
