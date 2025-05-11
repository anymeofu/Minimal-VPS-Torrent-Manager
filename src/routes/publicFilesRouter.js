const express = require('express');
const router = express.Router();
const path = require('path');
const fsSync = require('fs'); // Using sync for existsSync and statSync

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');

// GET /serve_file/:filePath(*) - Serve a file from DOWNLOADS_DIR
router.get('/:filePath(*)', (req, res) => {
  const { filePath } = req.params;
  if (!filePath) {
    return res.status(400).send('File path is required.');
  }

  const absoluteFilePath = path.resolve(DOWNLOADS_DIR, filePath);

  // Security: Ensure the path is still within DOWNLOADS_DIR
  if (!absoluteFilePath.startsWith(path.resolve(DOWNLOADS_DIR))) {
    return res.status(403).send('Forbidden: Access to this path is not allowed.');
  }

  if (!fsSync.existsSync(absoluteFilePath)) {
    return res.status(404).send('File not found.');
  }

  const stats = fsSync.statSync(absoluteFilePath);
  if (stats.isDirectory()) {
    return res.status(400).send('Cannot serve a directory directly.');
  }
  
  res.sendFile(absoluteFilePath, (err) => {
    if (err) {
      console.error(`Error serving file ${absoluteFilePath}:`, err);
      if (!res.headersSent) {
        res.status(err.status || 500).send('Error serving file.');
      }
    }
  });
});

module.exports = router; // No db needed for this simple file server
