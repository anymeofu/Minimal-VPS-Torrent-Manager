import React, { useState, useEffect, useCallback } from 'react';

function FilesTab() {
  const [files, setFiles] = useState([]);
  const [storageInfo, setStorageInfo] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mediaInfo, setMediaInfo] = useState({}); 
  const [currentPath, setCurrentPath] = useState('');
  const [isUnarchiving, setIsUnarchiving] = useState({}); // { [itemRelativePath]: true/false }

  const fetchFiles = useCallback(async (pathToFetch) => {
    try {
      const response = await fetch(`/api/files/download_contents?path=${encodeURIComponent(pathToFetch)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setFiles(data);
      setError(''); // Clear previous errors on successful fetch
    } catch (e) {
      console.error("Failed to fetch files:", e);
      setError(`Failed to load files for "${pathToFetch || '/'}". ${e.message}`);
      setFiles([]); // Clear files on error to avoid showing stale data
    }
  }, []);

  const fetchStorageInfo = useCallback(async () => {
    try {
      const response = await fetch('/api/files/space');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setStorageInfo(data);
    } catch (e) {
      console.error("Failed to fetch storage info:", e);
      // Don't set main error for this, just log
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentPath);
    fetchStorageInfo(); // Fetch storage info once initially and then on interval
    const intervalId = setInterval(() => {
        fetchFiles(currentPath); // Refresh current view
        fetchStorageInfo();
    }, 10000); // Refresh every 10 seconds
    return () => clearInterval(intervalId);
  }, [currentPath, fetchFiles, fetchStorageInfo]);

  const handleDeleteFile = async (itemRelativePath) => {
    setError('');
    setMessage('');
    if (!window.confirm(`Are you sure you want to delete "${itemRelativePath}"? This cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemPath: itemRelativePath }), // API expects itemPath relative to DOWNLOADS_DIR
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      setMessage(data.message || 'Item deleted successfully.');
      fetchFiles(currentPath); // Refresh file list for current path
      setMediaInfo(prev => { // Remove media info for deleted file
        const newState = {...prev};
        delete newState[itemRelativePath]; // Use relativePath as key
        return newState;
      });
    } catch (e) {
      console.error("Failed to delete item:", e);
      setError('Failed to delete item. ' + e.message);
    }
  };

  const handleUnarchive = async (itemRelativePath) => {
    setError('');
    setMessage('');
    setIsUnarchiving(prev => ({ ...prev, [itemRelativePath]: true }));
    try {
      const response = await fetch('/api/files/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemPath: itemRelativePath }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to unarchive.');
      }
      setMessage(data.message || `Successfully unarchived ${itemRelativePath}.`);
      fetchFiles(currentPath); // Refresh file list
    } catch (e) {
      console.error("Failed to unarchive:", e);
      setError(`Failed to unarchive ${itemRelativePath}: ${e.message}`);
    } finally {
      setIsUnarchiving(prev => ({ ...prev, [itemRelativePath]: false }));
    }
  };

  const handleMatchImdb = async (item) => { 
    const key = item.relativePath; 
    setError('');
    setMessage('');
    setMediaInfo(prev => ({...prev, [key]: { loading: true }}));
    try {
      // Use item.name for matching, as it's the pure file/folder name
      const response = await fetch(`/api/media/match/${encodeURIComponent(item.name)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      setMediaInfo(prev => ({...prev, [key]: data }));
    } catch (e) {
      console.error("Failed to match IMDB:", e);
      setMediaInfo(prev => ({...prev, [key]: { error: e.message }}));
    }
  };

  const handleItemClick = (item) => {
    if (item.type === 'folder' || item.type === 'parent') {
      setCurrentPath(item.relativePath);
      setFiles([]); // Clear files immediately for responsiveness
      setError(''); // Clear errors when navigating
      setMessage('');
    }
    // If it's a file, clicking does nothing for now (could open/preview in future)
  };
  
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <h2>File Management (Downloads Directory)</h2>
      
      {error && <p style={{ color: '#e74c3c' }}>Error: {error}</p>}
      {message && <p style={{ color: '#2ecc71' }}>{message}</p>}

      {storageInfo && (
        <div className="storage-info" style={{marginBottom: '20px'}}>
          <strong>Storage ({storageInfo.mountedOn || storageInfo.filesystem || 'N/A'}):</strong> Total: {storageInfo.total}, Used: {storageInfo.used} ({storageInfo.usePercent}), Free: {storageInfo.free}
        </div>
      )}

      <h3>Files and Folders in: /downloads/{currentPath}</h3>
      {files.length === 0 && !error && <p>Loading or directory is empty...</p>}
      {files.length === 0 && error && <p style={{ color: '#e74c3c' }}>{error}</p>}
      
      {files.length > 0 && (
        <ul>
          {files.map((item) => (
            <li key={item.relativePath || item.name} style={{ marginBottom: '15px', cursor: (item.type === 'folder' || item.type === 'parent') ? 'pointer' : 'default' }} 
                onClick={() => (item.type === 'folder' || item.type === 'parent') ? handleItemClick(item) : null}>
              <strong>Name:</strong> {item.name} ({item.type})
              {item.type !== 'parent' && <><br /><strong>Size:</strong> {formatSize(item.size)}</>}
              {item.type !== 'parent' && <><br /><strong>Created:</strong> {new Date(item.createdAt).toLocaleString()}</>}
              <br />
              {item.type !== 'parent' && 
                <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(item.relativePath);}} style={{backgroundColor: '#e74c3c', marginRight: '10px', marginTop: '5px'}}>Delete</button>
              }
              {/* Show IMDB match for files and folders, but not for "parent" entry */}
              {/* IMDB Match Button */}
              {(item.type === 'file' || item.type === 'folder') && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleMatchImdb(item);}} 
                  style={{marginTop: '5px', marginRight: '10px'}}
                  disabled={isUnarchiving[item.relativePath]}
                >
                  Match IMDB Info
                </button>
              )}
              {/* Use for Torrent Button */}
              {(item.type === 'file' || item.type === 'folder') && (
                <button 
                  onClick={(e) => { 
                    e.stopPropagation();
                    sessionStorage.setItem('torrentSourcePath', item.relativePath);
                    sessionStorage.setItem('torrentSourceNameSuggestion', item.name); 
                    setMessage(`Set "${item.relativePath}" (name: "${item.name}") as source for new torrent. Go to Torrents tab.`);
                  }} 
                  style={{marginTop: '5px', marginRight: '10px'}}
                  disabled={isUnarchiving[item.relativePath]}
                >
                  Use for New Torrent
                </button>
              )}
              {/* Unarchive Button */}
              {item.type === 'file' && ['.zip', '.rar', '.tar.gz', '.tar'].some(ext => item.name.toLowerCase().endsWith(ext)) && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleUnarchive(item.relativePath);}} 
                  style={{marginTop: '5px'}}
                  disabled={isUnarchiving[item.relativePath]}
                >
                  {isUnarchiving[item.relativePath] ? 'Unarchiving...' : 'Unarchive'}
                </button>
              )}

              {mediaInfo[item.relativePath] && (
                <div style={{marginTop: '10px', paddingLeft: '15px', borderLeft: '2px solid #00b8ff'}}>
                  {mediaInfo[item.relativePath].loading && <p>Loading IMDB info...</p>}
                  {mediaInfo[item.relativePath].error && <p style={{color: '#e74c3c'}}>IMDB Error: {mediaInfo[item.relativePath].error}</p>}
                  {mediaInfo[item.relativePath].title && (
                    <>
                      <h4>{mediaInfo[item.relativePath].title} ({mediaInfo[item.relativePath].year})</h4>
                      {mediaInfo[item.relativePath].posterUrl && mediaInfo[item.relativePath].posterUrl !== 'N/A' && (
                        <img src={mediaInfo[item.relativePath].posterUrl} alt="Poster" style={{maxWidth: '100px', maxHeight: '150px', float: 'left', marginRight: '10px'}}/>
                      )}
                      <p><strong>Rating:</strong> {mediaInfo[item.relativePath].rating || 'N/A'}</p>
                      <p><strong>Genres:</strong> {mediaInfo[item.relativePath].genres ? mediaInfo[item.relativePath].genres.join(', ') : 'N/A'}</p>
                      <p><strong>Plot:</strong> {mediaInfo[item.relativePath].plot || 'N/A'}</p>
                      <div style={{clear: 'both'}}></div>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FilesTab;
