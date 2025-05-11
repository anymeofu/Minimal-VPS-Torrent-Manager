const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Use promises version
const fsSync = require('fs'); // For existsSync
const util = require('util');
const createTorrent = require('create-torrent');
const createTorrentAsync = util.promisify(createTorrent); // Promisify create-torrent

const TORRENTS_DIR = path.join(__dirname, '..', '..', 'torrents');
const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads'); // Used to validate sourcePath

// Ensure torrents directory exists
if (!fsSync.existsSync(TORRENTS_DIR)) { // Use fsSync for initial setup
  fsSync.mkdirSync(TORRENTS_DIR, { recursive: true });
  console.log(`Created torrents directory: ${TORRENTS_DIR}`);
}

// Promisify db.run / db.prepare for use with async/await
function DbrunAsync(dbInstance, sql, params) {
  return new Promise((resolve, reject) => {
    // Using 'this' from db.run for lastID, changes
    const stmt = dbInstance.prepare(sql, function(err) {
        if (err) return reject(err);
        // Need to bind 'this' from prepare for stmt.run
        stmt.run(params, function(runErr) {
            if (runErr) return reject(runErr);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
        stmt.finalize();
    });
  });
}


module.exports = function(db) {

  // POST /api/torrents - Create a torrent (Refactored with Promises)
  router.post('/', async (req, res) => {
    const { sourcePath, name, webseeds, isPrivate, announceList } = req.body;

    if (!sourcePath || !name) {
      return res.status(400).json({ error: 'sourcePath and name are required.' });
    }

    const absoluteSourcePath = path.resolve(DOWNLOADS_DIR, sourcePath);
    if (!absoluteSourcePath.startsWith(path.resolve(DOWNLOADS_DIR))) {
        return res.status(400).json({ error: 'Invalid sourcePath. Must be within the downloads directory.' });
    }

    if (!fsSync.existsSync(absoluteSourcePath)) {
      return res.status(400).json({ error: `Source path does not exist: ${absoluteSourcePath}` });
    }

    const torrentFileName = `${name.replace(/[^a-zA-Z0-9.-]/g, '_')}_${Date.now()}.torrent`;
    const torrentFilePath = path.join(TORRENTS_DIR, torrentFileName);

    try {
      const stats = await fs.stat(absoluteSourcePath); // Get stats to check if it's a file or directory
      let torrentInfoName;

      if (stats.isFile()) {
        // For single file torrents, the 'name' in torrent metadata should be the actual filename
        torrentInfoName = path.basename(absoluteSourcePath);
      } else {
        // For directory torrents, the 'name' is the root folder name in the torrent
        // The user-provided 'name' from the form is suitable here.
        torrentInfoName = name;
      }

      const defaultTrackers = [
        'udp://tracker.openbittorrent.com:80',
        'udp://tracker.opentrackr.org:1337/announce'
      ];
      const trackers = announceList && announceList.length > 0 ? announceList : defaultTrackers;
      const opts = {
        name: torrentInfoName, // Use the determined name for torrent's internal metadata
        comment: `Created by VPS Torrent Manager for source: ${name}`, // Use user's 'name' in comment
        createdBy: 'VPS Torrent Manager',
        private: !!isPrivate,
        announceList: trackers.map(t => [t]),
        urlList: webseeds || []
      };

      const torrentBuffer = await createTorrentAsync(absoluteSourcePath, opts);
      await fs.writeFile(torrentFilePath, torrentBuffer);
      
      const dbResult = await DbrunAsync(db, 
        `INSERT INTO torrents (name, filePath, sourcePath, webseeds, isPrivate, createdAt) 
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [name, torrentFilePath, sourcePath, JSON.stringify(webseeds || []), !!isPrivate]
      );

      res.status(201).json({ 
        message: 'Torrent created successfully.', 
        torrentId: dbResult.lastID,
        fileName: torrentFileName,
        filePath: torrentFilePath 
      });

    } catch (error) {
      console.error('Error in torrent creation process:', error);
      // Attempt to clean up .torrent file if it was created before an error
      if (fsSync.existsSync(torrentFilePath)) {
        try {
          await fs.unlink(torrentFilePath);
        } catch (cleanupErr) {
          console.error('Error cleaning up torrent file after failure:', cleanupErr);
        }
      }
      res.status(500).json({ error: `Failed to create torrent: ${error.message}` });
    }
  });

  // GET /api/torrents - List torrents
  router.get('/', (req, res) => {
    db.all('SELECT id, name, filePath, sourcePath, createdAt, isPrivate FROM torrents ORDER BY createdAt DESC', [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve torrents: ' + err.message });
      }
      res.json(rows);
    });
  });

  // GET /api/torrents/:id/file - Download .torrent file
  router.get('/:id/file', (req, res) => {
    const { id } = req.params;
    db.get('SELECT filePath, name FROM torrents WHERE id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Torrent not found.' });
      }
      if (!fsSync.existsSync(row.filePath)) { // Use fsSync for existsSync
        return res.status(404).json({ error: '.torrent file not found on disk. It might have been deleted.' });
      }
      // Sanitize display name for download
      const displayName = (row.name || 'torrent').replace(/[^a-zA-Z0-9.-]/g, '_') + '.torrent';
      res.download(row.filePath, displayName, (downloadErr) => {
        if (downloadErr) {
            console.error("Error sending torrent file:", downloadErr);
            // Avoid sending another response if headers already sent
            if (!res.headersSent) {
                 res.status(500).json({ error: 'Failed to download torrent file.' });
            }
        }
      });
    });
  });

  // DELETE /api/torrents/:id - Delete a torrent (record and .torrent file)
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT filePath FROM torrents WHERE id = ?', [id], async (err, row) => { // Made this callback async
      if (err) {
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Torrent not found.' });
      }

      try {
        const dbResult = await DbrunAsync(db, 'DELETE FROM torrents WHERE id = ?', [id]);
        if (dbResult.changes === 0) {
          return res.status(404).json({ error: 'Torrent not found for deletion in DB.' });
        }
        // Delete the .torrent file
        if (row.filePath && fsSync.existsSync(row.filePath)) { // Use fsSync
          await fs.unlink(row.filePath);
        }
        res.json({ message: 'Torrent record and .torrent file deleted successfully.' });
      } catch (dbOrFsErr) {
        console.error(`Error during torrent deletion (ID: ${id}):`, dbOrFsErr);
        res.status(500).json({ error: `Failed to delete torrent: ${dbOrFsErr.message}` });
      }
    });
  });

  return router;
};
