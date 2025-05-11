const express = require('express');
const router = express.Router();
const fs = require('fs').promises; 
const fsSync = require('fs'); 
const path = require('path');
const { exec } = require('child_process');
const util = require('util'); // Added util
const execAsync = util.promisify(exec); // Added execAsync
const extractZip = require('extract-zip'); // Added extract-zip require

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');

module.exports = function(db) { 
  // GET /api/files/space - Get storage info
  router.get('/space', (req, res) => {
    // df -h /path/to/downloads_dir might be more specific, or just root '/'
    // For simplicity, using root. Adjust target path if downloads are on a separate mount.
    exec(`df -h "${DOWNLOADS_DIR}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error getting disk space with df for ${DOWNLOADS_DIR}:`, stderr);
        // Fallback to root if specific path fails (e.g. not a mount point)
        exec('df -h /', (fallbackError, fallbackStdout, fallbackStderr) => {
          if (fallbackError) {
            console.error('Error getting disk space with df for /:', fallbackStderr);
            return res.status(500).json({ error: 'Failed to get disk space information.' });
          }
          parseDfOutput(fallbackStdout, res);
        });
        return;
      }
      parseDfOutput(stdout, res);
    });
  });

  function parseDfOutput(dfOutput, res) {
    const lines = dfOutput.trim().split('\n');
    if (lines.length < 2) {
      return res.status(500).json({ error: 'Unexpected df output format.' });
    }
    // Filesystem Size Used Avail Use% Mounted on
    // /dev/sda1    20G  5.0G   14G  27% /
    const parts = lines[1].split(/\s+/);
    if (parts.length < 5) {
      return res.status(500).json({ error: 'Unexpected df output columns.' });
    }
    res.json({
      filesystem: parts[0],
      total: parts[1],
      used: parts[2],
      free: parts[3],
      usePercent: parts[4],
      mountedOn: parts[5] || DOWNLOADS_DIR // If mountedOn is not last, take DOWNLOADS_DIR
    });
  }

  // GET /api/files/download_contents - List files and folders in DOWNLOADS_DIR or a sub-path
  router.get('/download_contents', async (req, res) => {
    const relativePathQuery = req.query.path || ''; // Get path from query, default to root of DOWNLOADS_DIR
    
    // Security: Ensure relativePathQuery does not try to escape DOWNLOADS_DIR
    const currentPathBase = path.resolve(DOWNLOADS_DIR, relativePathQuery);
    if (!currentPathBase.startsWith(path.resolve(DOWNLOADS_DIR))) {
      return res.status(400).json({ error: 'Invalid path specified.' });
    }
    if (!fsSync.existsSync(currentPathBase) || ! (await fs.stat(currentPathBase)).isDirectory()) {
        return res.status(404).json({ error: 'Specified path is not a valid directory.'});
    }

    try {
      const items = await fs.readdir(currentPathBase, { withFileTypes: true });
      const fileDetails = await Promise.all(
        items.map(async (item) => {
          const itemPath = path.join(currentPathBase, item.name); // Full path for stat
          const itemRelativePath = path.join(relativePathQuery, item.name); // Path relative to DOWNLOADS_DIR for client
          let stats;
          try {
            stats = await fs.stat(itemPath);
          } catch (statErr) {
            console.error(`Failed to stat ${itemPath}:`, statErr);
            return { name: item.name, type: 'unknown', error: 'Failed to get stats' };
          }
          return {
            name: item.name, // Just the name
            relativePath: itemRelativePath, // Path relative to DOWNLOADS_DIR
            type: item.isDirectory() ? 'folder' : 'file',
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
        })
      );
      // Add a way to go "up" if not in the root
      const parentPath = relativePathQuery ? path.dirname(relativePathQuery) : null;
      if (relativePathQuery && parentPath !== '.' && parentPath !== '') {
        fileDetails.unshift({ name: '.. (Parent Directory)', relativePath: parentPath, type: 'parent', size: 0 });
      } else if (relativePathQuery) { // current path is a top-level dir, parent is root
         fileDetails.unshift({ name: '.. (Parent Directory)', relativePath: '', type: 'parent', size: 0 });
      }


      res.json(fileDetails);
    } catch (error) {
      console.error('Error listing download contents:', error);
      res.status(500).json({ error: 'Failed to list download contents.' });
    }
  });

  // POST /api/files/delete - Delete a file or folder from DOWNLOADS_DIR
  router.post('/delete', async (req, res) => {
    const { itemPath } = req.body; // itemPath is relative to DOWNLOADS_DIR

    if (!itemPath) {
      return res.status(400).json({ error: 'itemPath is required.' });
    }

    // Security: Basic path validation
    const absoluteItemPath = path.resolve(DOWNLOADS_DIR, itemPath);
    if (!absoluteItemPath.startsWith(path.resolve(DOWNLOADS_DIR))) {
      return res.status(400).json({ error: 'Invalid itemPath. Must be within the downloads directory.' });
    }
    
    if (!fsSync.existsSync(absoluteItemPath)) { // Use sync for pre-check
        return res.status(404).json({ error: 'File or folder not found.' });
    }

    try {
      const stats = await fs.stat(absoluteItemPath);
      if (stats.isDirectory()) {
        // Use fs.rmdir for older Node.js versions. recursive:true needs Node v12.10.0+
        // If Node is even older, this might still be an issue, but rmdir is more standard.
        await fs.rmdir(absoluteItemPath, { recursive: true }); 
      } else {
        await fs.unlink(absoluteItemPath);
      }
      // Also remove from media_files table if it exists there
      // Path stored in media_files is absolute, or needs to be resolved
      // For now, we assume filePath in media_files matches absoluteItemPath if it's a file
      // This part needs careful consideration of how paths are stored in media_files
      if (!stats.isDirectory()) {
         db.run('DELETE FROM media_files WHERE filePath = ?', [absoluteItemPath], (err) => {
            if (err) console.error(`Error deleting media_file record for ${absoluteItemPath}: ${err.message}`);
         });
      } else {
        // For directories, one might want to delete all media_file entries within that dir path
        db.run('DELETE FROM media_files WHERE filePath LIKE ?', [absoluteItemPath + '%'], (err) => {
            if (err) console.error(`Error deleting media_file records for dir ${absoluteItemPath}: ${err.message}`);
        });
      }


      res.json({ message: `Successfully deleted ${itemPath}` });
    } catch (error) {
      console.error(`Error deleting ${itemPath}:`, error);
      res.status(500).json({ error: `Failed to delete ${itemPath}.` });
    }
  });

  // The /serve/:filePath(*) route has been moved to publicFilesRouter.js

  // POST /api/files/unarchive - Manually unarchive a file
  router.post('/unarchive', async (req, res) => {
    const { itemPath } = req.body; // itemPath is relative to DOWNLOADS_DIR

    if (!itemPath) {
      return res.status(400).json({ error: 'itemPath is required.' });
    }

    const absoluteItemPath = path.resolve(DOWNLOADS_DIR, itemPath);
    if (!absoluteItemPath.startsWith(path.resolve(DOWNLOADS_DIR))) {
      return res.status(400).json({ error: 'Invalid itemPath.' });
    }
    if (!fsSync.existsSync(absoluteItemPath) || (await fs.stat(absoluteItemPath)).isDirectory()) {
        return res.status(404).json({ error: 'Archive file not found or is a directory.'});
    }

    const fileExtension = path.extname(absoluteItemPath).toLowerCase();
    let targetPath = '';
    let success = false;

    // Simplified extraction logic here, similar to downloads.js#attemptExtraction
    // No DB updates here as this is a manual operation on an existing file.
    // Frontend will need to refresh file list.
    try {
      // setMessageToClient(res, `Extracting ${itemPath}...`); // Progress not implemented for manual unarchive

      if (fileExtension === '.zip') {
        const targetDirName = path.basename(absoluteItemPath, '.zip');
        targetPath = path.join(DOWNLOADS_DIR, targetDirName);
        if (!fsSync.existsSync(targetPath)) fsSync.mkdirSync(targetPath, { recursive: true });
        await extractZip(absoluteItemPath, { dir: targetPath });
        success = true;
      } else if (fileExtension === '.rar') {
        const targetDirName = path.basename(absoluteItemPath, '.rar');
        targetPath = path.join(DOWNLOADS_DIR, targetDirName);
        if (!fsSync.existsSync(targetPath)) fsSync.mkdirSync(targetPath, { recursive: true });
        await execAsync(`unrar x -o+ -p- "${absoluteItemPath}" "${targetPath}/"`);
        success = true;
      } else if (fileExtension === '.gz' && absoluteItemPath.endsWith('.tar.gz')) {
        const targetDirName = path.basename(absoluteItemPath, '.tar.gz');
        targetPath = path.join(DOWNLOADS_DIR, targetDirName);
        if (!fsSync.existsSync(targetPath)) fsSync.mkdirSync(targetPath, { recursive: true });
        await execAsync(`tar -xzf "${absoluteItemPath}" -C "${targetPath}"`);
        success = true;
      } else if (fileExtension === '.tar') {
        const targetDirName = path.basename(absoluteItemPath, '.tar');
        targetPath = path.join(DOWNLOADS_DIR, targetDirName);
        if (!fsSync.existsSync(targetPath)) fsSync.mkdirSync(targetPath, { recursive: true });
        await execAsync(`tar -xf "${absoluteItemPath}" -C "${targetPath}"`);
        success = true;
      } else {
        return res.status(400).json({ error: `Unsupported archive type: ${fileExtension}` });
      }

      if (success) {
        res.json({ message: `Successfully extracted ${itemPath} to ${targetPath.replace(DOWNLOADS_DIR, '')}` });
      } else { 
        // Should have been caught by specific errors below
        res.status(500).json({ error: `Extraction failed for ${itemPath}.`});
      }
    } catch (error) {
      console.error(`Error extracting ${itemPath}:`, error);
      res.status(500).json({ error: `Failed to extract ${itemPath}: ${error.message}` });
    }
  });
  
  // Helper for future progress updates (not implemented yet for unarchive)
  // function setMessageToClient(res, message) {
  //   if (!res.headersSent) {
  //      // For actual progress, would need SSE or WebSockets
  //   }
  // }


  return router;
};
