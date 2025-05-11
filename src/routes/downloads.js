const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs'); 
const fsPromises = require('fs').promises;
const axios = require('axios');
const extractZip = require('extract-zip'); // Renamed for clarity
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');

// In-memory store for live download progress
const downloadProgressStore = {};

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  console.log(`Created downloads directory: ${DOWNLOADS_DIR}`);
}

module.exports = function(db) {

  router.post('/', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    try {
      // Initialize progress fields in DB
      const stmt = db.prepare('INSERT INTO downloads (url, status, totalBytes, downloadedBytes) VALUES (?, ?, 0, 0)');
      stmt.run(url, 'pending', function(err) {
        if (err) {
          console.error('Error inserting download into DB:', err.message);
          return res.status(500).json({ error: 'Failed to queue download.' });
        }
        const downloadId = this.lastID;
        res.status(202).json({ message: 'Download queued.', downloadId });
        processDownload(url, downloadId, db);
      });
      stmt.finalize();
    } catch (error) {
      console.error('Error queuing download:', error);
      res.status(500).json({ error: 'Failed to queue download' });
    }
  });

  async function processDownload(url, downloadId, dbInstance) {
    let filePath = '';
    let currentDownloadedBytes = 0; 

    try {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
      });

      const totalBytes = parseInt(response.headers['content-length'] || '0');
      dbInstance.run('UPDATE downloads SET status = ?, totalBytes = ?, downloadedBytes = 0 WHERE id = ?', 
        ['downloading', totalBytes, downloadId]);
      
      downloadProgressStore[downloadId] = { 
        downloadedBytes: 0, 
        totalBytes: totalBytes,
        lastUpdated: Date.now() 
      };

      const contentDisposition = response.headers['content-disposition'];
      let filename = url.substring(url.lastIndexOf('/') + 1) || `download_${Date.now()}`;
      if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(;|$)/i);
          if (filenameMatch && filenameMatch[1]) filename = filenameMatch[1];
      }
      filename = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
      if (!filename) filename = `download_${Date.now()}_fallback`;

      filePath = path.join(DOWNLOADS_DIR, filename);
      const writer = fs.createWriteStream(filePath);

      response.data.on('data', chunk => {
        currentDownloadedBytes += chunk.length;
        if (downloadProgressStore[downloadId]) {
            downloadProgressStore[downloadId].downloadedBytes = currentDownloadedBytes;
            downloadProgressStore[downloadId].lastUpdated = Date.now();
        }
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', () => {
          dbInstance.run('UPDATE downloads SET status = ?, filePath = ?, downloadedBytes = ? WHERE id = ?', 
            ['completed', filePath, totalBytes, downloadId], () => { 
            delete downloadProgressStore[downloadId];
            resolve();
          });
        });
        writer.on('error', (err) => {
          dbInstance.run('UPDATE downloads SET status = ?, downloadedBytes = ? WHERE id = ?', 
            ['error', currentDownloadedBytes, downloadId], () => {
            delete downloadProgressStore[downloadId];
            reject(err);
          });
        });
      });

      console.log(`Download ${downloadId} completed: ${filePath}`);
      await attemptExtraction(filePath, downloadId, dbInstance);
    } catch (error) {
      console.error(`Error processing download ${downloadId} (${url}):`, error.message);
      dbInstance.run('UPDATE downloads SET status = ?, downloadedBytes = ? WHERE id = ?', 
        ['error', currentDownloadedBytes, downloadId]);
      delete downloadProgressStore[downloadId];
      if (filePath && fs.existsSync(filePath)) {
        // fs.unlinkSync(filePath); // Optionally delete partial
      }
    }
  }

  async function attemptExtraction(sourcePath, downloadId, dbInstance) {
    const fileExtension = path.extname(sourcePath).toLowerCase();
    if (fileExtension === '.zip') {
      try {
        dbInstance.run('UPDATE downloads SET status = ? WHERE id = ?', ['extracting', downloadId]);
        const targetDirName = path.basename(sourcePath, '.zip');
        const targetPath = path.join(DOWNLOADS_DIR, targetDirName);
        if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
        await extractZip(sourcePath, { dir: targetPath }); // Use renamed extractZip
        dbInstance.run('UPDATE downloads SET status = ?, extractedPath = ? WHERE id = ?', ['completed', targetPath, downloadId]);
        console.log(`Extracted ZIP ${sourcePath} to ${targetPath}`);
      } catch (err) {
        console.error(`Error extracting ZIP ${sourcePath}:`, err);
        dbInstance.run('UPDATE downloads SET status = ? WHERE id = ?', ['error_extracting_zip', downloadId]);
      }
    } else if (fileExtension === '.rar') {
      try {
        dbInstance.run('UPDATE downloads SET status = ? WHERE id = ?', ['extracting', downloadId]);
        const targetDirName = path.basename(sourcePath, '.rar');
        const targetPath = path.join(DOWNLOADS_DIR, targetDirName);
        if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
        
        // Using system 'unrar' command. Requires 'unrar' to be installed and in PATH.
        // Example: unrar x -o+ -p- <archive_path> <destination_path>
        // -o+ : overwrite existing files
        // -p- : do not prompt for password
        await execAsync(`unrar x -o+ -p- "${sourcePath}" "${targetPath}/"`); // Ensure targetPath ends with slash for unrar
        dbInstance.run('UPDATE downloads SET status = ?, extractedPath = ? WHERE id = ?', ['completed', targetPath, downloadId]);
        console.log(`Extracted RAR ${sourcePath} to ${targetPath} using system unrar.`);
      } catch (err) {
        console.error(`Error extracting RAR ${sourcePath} (ensure 'unrar' is installed):`, err);
        dbInstance.run('UPDATE downloads SET status = ? WHERE id = ?', ['error_extracting_rar', downloadId]);
      }
    } else if (fileExtension === '.gz' && sourcePath.endsWith('.tar.gz')) { // Handle .tar.gz
      try {
        dbInstance.run('UPDATE downloads SET status = ? WHERE id = ?', ['extracting', downloadId]);
        const baseName = path.basename(sourcePath, '.tar.gz');
        const targetPath = path.join(DOWNLOADS_DIR, baseName);
        if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });

        // Using system 'tar' command. Requires 'tar' to be installed.
        // tar -xzf <archive_path> -C <destination_path>
        await execAsync(`tar -xzf "${sourcePath}" -C "${targetPath}"`);
        dbInstance.run('UPDATE downloads SET status = ?, extractedPath = ? WHERE id = ?', ['completed', targetPath, downloadId]);
        console.log(`Extracted TAR.GZ ${sourcePath} to ${targetPath} using system tar.`);
      } catch (err) {
        console.error(`Error extracting TAR.GZ ${sourcePath} (ensure 'tar' is installed):`, err);
        dbInstance.run('UPDATE downloads SET status = ? WHERE id = ?', ['error_extracting_targz', downloadId]);
      }
    } else if (fileExtension === '.tar') { // Handle .tar
      try {
        dbInstance.run('UPDATE downloads SET status = ? WHERE id = ?', ['extracting', downloadId]);
        const baseName = path.basename(sourcePath, '.tar');
        const targetPath = path.join(DOWNLOADS_DIR, baseName);
        if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });

        // Using system 'tar' command.
        // tar -xf <archive_path> -C <destination_path>
        await execAsync(`tar -xf "${sourcePath}" -C "${targetPath}"`);
        dbInstance.run('UPDATE downloads SET status = ?, extractedPath = ? WHERE id = ?', ['completed', targetPath, downloadId]);
        console.log(`Extracted TAR ${sourcePath} to ${targetPath} using system tar.`);
      } catch (err) {
        console.error(`Error extracting TAR ${sourcePath} (ensure 'tar' is installed):`, err);
        dbInstance.run('UPDATE downloads SET status = ? WHERE id = ?', ['error_extracting_tar', downloadId]);
      }
    } // Add more types like .tar.bz2 if needed
  }

  router.get('/', (req, res) => {
    db.all('SELECT * FROM downloads ORDER BY createdAt DESC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const augmentedRows = rows.map(row => {
        if (row.status === 'downloading' && downloadProgressStore[row.id]) {
          return { ...row, ...downloadProgressStore[row.id] }; 
        }
        return row;
      });
      res.json(augmentedRows);
    });
  });

  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT filePath, extractedPath FROM downloads WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Failed to query download for deletion.' });
      if (!row) return res.status(404).json({ error: 'Download not found.' });

      db.run('DELETE FROM downloads WHERE id = ?', id, async function(deleteErr) { 
        if (deleteErr) return res.status(500).json({ error: 'Failed to delete download record.' });
        if (this.changes === 0) return res.status(404).json({ error: 'Download not found for deletion.' });

        delete downloadProgressStore[id]; 

        try {
            if (row.filePath && fs.existsSync(row.filePath)) {
              await fsPromises.unlink(row.filePath);
            }
            if (row.extractedPath && fs.existsSync(row.extractedPath)) {
              await fsPromises.rm(row.extractedPath, { recursive: true, force: true });
            }
        } catch (fsErr) {
            console.error(`Error deleting files for download ID ${id}:`, fsErr);
        }
        res.json({ message: 'Download and associated files marked for deletion.' });
      });
    });
  });

  return router;
};
