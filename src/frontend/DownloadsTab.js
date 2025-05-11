import React, { useState, useEffect, useCallback } from 'react';

function DownloadsTab() {
  const [downloads, setDownloads] = useState([]);
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [downloadProgressState, setDownloadProgressState] = useState({}); // For speed calculation: { [id]: { prevBytes: X, prevTime: Y, speed: Z } }

  const fetchDownloads = useCallback(async () => {
    try {
      const response = await fetch('/api/downloads');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      // Calculate speed for downloading items
      const newProgressState = { ...downloadProgressState };
      data.forEach(d => {
        if (d.status === 'downloading' && d.downloadedBytes !== undefined) {
          const prev = downloadProgressState[d.id];
          const currentTime = Date.now();
          if (prev && prev.prevBytes !== undefined && prev.prevTime !== undefined) {
            const timeDiffSeconds = (currentTime - prev.prevTime) / 1000;
            const bytesDiff = d.downloadedBytes - prev.prevBytes;
            if (timeDiffSeconds > 0 && bytesDiff > 0) {
              const speed = bytesDiff / timeDiffSeconds; // Bytes per second
              newProgressState[d.id] = { ...prev, speed: speed, prevBytes: d.downloadedBytes, prevTime: currentTime };
            } else if (bytesDiff === 0 && timeDiffSeconds > 1) { // If no progress for a bit, show 0 speed
              newProgressState[d.id] = { ...prev, speed: 0, prevTime: currentTime };
            } else { // Not enough data or no change, keep old speed or init
              newProgressState[d.id] = { ...prev, prevBytes: d.downloadedBytes, prevTime: currentTime };
            }
          } else { // First time seeing this download or no previous data
            newProgressState[d.id] = { prevBytes: d.downloadedBytes, prevTime: currentTime, speed: 0 };
          }
        } else if (newProgressState[d.id]) { // If download finished or errored, clear its progress state
          delete newProgressState[d.id];
        }
      });
      setDownloadProgressState(newProgressState);
      setDownloads(data);
    } catch (e) {
      console.error("Failed to fetch downloads:", e);
      setError('Failed to load downloads. ' + e.message);
    }
  }, [downloadProgressState]); // Add downloadProgressState as dependency

  useEffect(() => {
    fetchDownloads();
    const intervalId = setInterval(fetchDownloads, 2000); // Poll faster for speed updates (e.g., 2 seconds)
    return () => clearInterval(intervalId);
  }, [fetchDownloads]);

  const handleAddDownload = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!newUrl.trim()) {
      setError('Please enter a URL.');
      return;
    }
    try {
      const response = await fetch('/api/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      setMessage(data.message || 'Download started.');
      setNewUrl('');
      fetchDownloads(); // Refresh list immediately
    } catch (e) {
      console.error("Failed to add download:", e);
      setError('Failed to add download. ' + e.message);
    }
  };

  const handleDeleteDownload = async (id) => {
    setError('');
    setMessage('');
    if (!window.confirm('Are you sure you want to delete this download and its files?')) {
      return;
    }
    try {
      const response = await fetch(`/api/downloads/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      setMessage(data.message || 'Download deleted.');
      fetchDownloads(); // Refresh list
    } catch (e) {
      console.error("Failed to delete download:", e);
      setError('Failed to delete download. ' + e.message);
    }
  };

  // handleRetentionInputChange and handleSetRetention removed
  
  const formatPath = (filePath) => {
    if (!filePath) return 'N/A';
    const downloadsDirMarker = '/downloads/'; // This might not be robust if path structure changes
    const idx = filePath.lastIndexOf(downloadsDirMarker);
    if (idx !== -1) {
        return filePath.substring(idx + downloadsDirMarker.length);
    }
    // Fallback to just the filename if '/downloads/' is not in the path
    return filePath.substring(filePath.lastIndexOf('/') + 1); 
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div>
      <h2>Download Management</h2>
      <form onSubmit={handleAddDownload}>
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="Enter URL to download"
          style={{ width: '70%', marginRight: '10px' }}
          required
        />
        <button type="submit">Add Download</button>
      </form>
      {error && <p style={{ color: '#e74c3c' }}>Error: {error}</p>}
      {message && <p style={{ color: '#2ecc71' }}>{message}</p>}

      <h3>Current Downloads</h3>
      {downloads.length === 0 ? (
        <p>No downloads yet.</p>
      ) : (
        <ul>
          {downloads.map((d) => (
            <li key={d.id}>
              <strong>URL:</strong> {d.url}<br />
              <strong>Status:</strong> <span className={`status-${d.status.toLowerCase()}`}>{d.status}</span>
              {d.status === 'downloading' && d.totalBytes > 0 && (
                <span>
                  {' (' + formatBytes(d.downloadedBytes)} / {formatBytes(d.totalBytes)} - 
                  {((d.downloadedBytes / d.totalBytes) * 100).toFixed(1)}%
                  {downloadProgressState[d.id] && downloadProgressState[d.id].speed > 0 && 
                    ` - ${formatBytes(downloadProgressState[d.id].speed)}/s`
                  }
                  {downloadProgressState[d.id] && downloadProgressState[d.id].speed === 0 && d.downloadedBytes > 0 &&
                    ` - stalled`
                  }
                  )
                </span>
              )}
               {d.status === 'downloading' && d.totalBytes === 0 && d.downloadedBytes > 0 && (
                <span> ({formatBytes(d.downloadedBytes)} downloaded)</span>
              )}
              <br />
              <strong>File:</strong> {formatPath(d.filePath)}<br />
              {d.extractedPath && <><strong>Extracted to:</strong> {formatPath(d.extractedPath)}<br /></>}
              <strong>Queued:</strong> {new Date(d.createdAt).toLocaleString()}<br />
              <button onClick={() => handleDeleteDownload(d.id)} style={{backgroundColor: '#e74c3c', marginTop: '5px'}}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DownloadsTab;
