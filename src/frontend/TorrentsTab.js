import React, { useState, useEffect, useCallback } from 'react';

function TorrentsTab() {
  const [torrents, setTorrents] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isCreatingTorrent, setIsCreatingTorrent] = useState(false); // For loading state

  // Form state for creating a new torrent
  const [sourcePath, setSourcePath] = useState('');
  const [torrentName, setTorrentName] = useState('');
  const [webseeds, setWebseeds] = useState(''); // Comma-separated
  const [isPrivate, setIsPrivate] = useState(false);
  const [announceList, setAnnounceList] = useState(''); // Comma-separated

  // State for listing downloadable files (future enhancement)
  // const [availableSources, setAvailableSources] = useState([]);

  // Check sessionStorage for a pre-selected source path and name suggestion on mount
  useEffect(() => {
    const preselectedPath = sessionStorage.getItem('torrentSourcePath');
    const nameSuggestion = sessionStorage.getItem('torrentSourceNameSuggestion');
    let infoMessage = '';

    if (preselectedPath) {
      setSourcePath(preselectedPath);
      sessionStorage.removeItem('torrentSourcePath');
      infoMessage += `Source path "${preselectedPath}" pre-filled. `;
    }

    if (nameSuggestion) {
      // User wants the suggested name to be the exact original name
      const suggestedName = nameSuggestion; 
      setTorrentName(suggestedName);
      sessionStorage.removeItem('torrentSourceNameSuggestion');
      infoMessage += `Torrent name "${suggestedName}" suggested.`;
    }
    
    if (infoMessage) {
        setMessage(infoMessage.trim());
    }

  }, []); // Empty dependency array means this runs once on mount

  const fetchTorrents = useCallback(async () => {
    try {
      const response = await fetch('/api/torrents');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setTorrents(data);
    } catch (e) {
      console.error("Failed to fetch torrents:", e);
      setError('Failed to load torrents. ' + e.message);
    }
  }, []);

  // Fetch available sources (e.g., files/folders in downloads directory)
  // useEffect(() => {
  //   const fetchSources = async () => {
  //     try {
  //       const response = await fetch('/api/files/list_downloads'); // Needs new endpoint
  //       if (!response.ok) throw new Error('Failed to fetch sources');
  //       const data = await response.json();
  //       setAvailableSources(data);
  //     } catch (e) {
  //       console.error("Failed to fetch sources:", e);
  //     }
  //   };
  //   fetchSources();
  // }, []);


  useEffect(() => {
    fetchTorrents();
    const intervalId = setInterval(fetchTorrents, 7000); // Refresh every 7 seconds
    return () => clearInterval(intervalId);
  }, [fetchTorrents]);

  const handleCreateTorrent = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsCreatingTorrent(true); // Set loading state

    if (!sourcePath.trim() || !torrentName.trim()) {
      setError('Source Path and Torrent Name are required.');
      return;
    }

    const payload = {
      sourcePath: sourcePath.trim(),
      name: torrentName.trim(),
      isPrivate: isPrivate,
      webseeds: webseeds.split(',').map(s => s.trim()).filter(s => s),
      announceList: announceList.split(',').map(s => s.trim()).filter(s => s),
    };

    try {
      const response = await fetch('/api/torrents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      setMessage(data.message || 'Torrent created successfully.');
      // Clear form
      setSourcePath('');
      setTorrentName('');
      setWebseeds('');
      setIsPrivate(false);
      setAnnounceList('');
      fetchTorrents(); // Refresh list
    } catch (e) {
      console.error("Failed to create torrent:", e);
      setError('Failed to create torrent. ' + e.message);
    } finally {
      setIsCreatingTorrent(false); // Clear loading state
    }
  };

  const handleDeleteTorrent = async (id) => {
    setError('');
    setMessage('');
    if (!window.confirm('Are you sure you want to delete this torrent record and its .torrent file?')) {
      return;
    }
    try {
      const response = await fetch(`/api/torrents/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      setMessage(data.message || 'Torrent deleted.');
      fetchTorrents(); // Refresh list
    } catch (e) {
      console.error("Failed to delete torrent:", e);
      setError('Failed to delete torrent. ' + e.message);
    }
  };

  const handleDownloadTorrentFile = (id) => {
    window.location.href = `/api/torrents/${id}/file`;
  };
  
  const formatTorrentSourcePath = (sP) => {
    if (!sP) return 'N/A';
    // Assuming sP is relative to the 'downloads' directory root for display
    return sP;
  };


  return (
    <div>
      <h2>Torrent Management</h2>
      
      <h3>Create New Torrent</h3>
      <form onSubmit={handleCreateTorrent} style={{ marginBottom: '20px' }}>
        <div>
          <label htmlFor="sourcePath">Source Path (relative to downloads dir, e.g., "myFile.mp4" or "myFolder"):</label><br/>
          <input
            type="text" id="sourcePath" value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            placeholder="e.g., sample-zip-file/sample.txt or sample-zip-file"
            style={{ width: '90%', marginBottom: '10px' }} required
          />
        </div>
        {/* TODO: Add a dropdown for availableSources once that API endpoint exists */}
        
        <div>
          <label htmlFor="torrentName">Torrent Name:</label><br/>
          <input
            type="text" id="torrentName" value={torrentName}
            onChange={(e) => setTorrentName(e.target.value)}
            placeholder="My Awesome Torrent"
            style={{ width: '90%', marginBottom: '10px' }} required
          />
        </div>
        <div>
          <label htmlFor="webseeds">Webseeds (comma-separated URLs, optional):</label><br/>
          <input
            type="text" id="webseeds" value={webseeds}
            onChange={(e) => setWebseeds(e.target.value)}
            placeholder="http://example.com/seed1, http://example.com/seed2"
            style={{ width: '90%', marginBottom: '10px' }}
          />
        </div>
        <div>
          <label htmlFor="announceList">Trackers (comma-separated, optional, defaults will be used if empty):</label><br/>
          <input
            type="text" id="announceList" value={announceList}
            onChange={(e) => setAnnounceList(e.target.value)}
            placeholder="udp://tracker.example.com:80"
            style={{ width: '90%', marginBottom: '10px' }}
          />
        </div>
        {sourcePath && !sourcePath.endsWith('/') && !sourcePath.endsWith('\\') && ( // Show only if sourcePath is likely a file
            <button 
                type="button" 
                onClick={() => {
                    const webseedUrl = `${window.location.origin}/serve_file/${sourcePath}`;
                    setWebseeds(prev => prev ? `${prev}, ${webseedUrl}` : webseedUrl);
                }}
                style={{marginBottom: '10px'}}
            >
                Suggest Self as Webseed
            </button>
        )}
        <div>
          <input
            type="checkbox" id="isPrivate" checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            style={{ marginRight: '5px' }}
          />
          <label htmlFor="isPrivate">Private Torrent</label>
        </div>
        <button type="submit" style={{ marginTop: '10px' }} disabled={isCreatingTorrent}>
          {isCreatingTorrent ? 'Creating...' : 'Create Torrent'}
        </button>
      </form>

      {isCreatingTorrent && <p>Creating torrent, please wait... This might take a while for large files.</p>}
      {error && <p style={{ color: '#e74c3c' }}>Error: {error}</p>}
      {message && <p style={{ color: '#2ecc71' }}>{message}</p>}

      <h3>Existing Torrents</h3>
      {torrents.length === 0 ? (
        <p>No torrents created yet.</p>
      ) : (
        <ul>
          {torrents.map((t) => (
            <li key={t.id}>
              <strong>Name:</strong> {t.name}<br />
              <strong>Source:</strong> {formatTorrentSourcePath(t.sourcePath)}<br />
              <strong>Private:</strong> {t.isPrivate ? 'Yes' : 'No'}<br />
              <strong>Created:</strong> {new Date(t.createdAt).toLocaleString()}<br />
              <button onClick={() => handleDownloadTorrentFile(t.id)} style={{marginRight: '10px', marginTop: '5px'}}>Download .torrent</button>
              <button onClick={() => handleDeleteTorrent(t.id)} style={{backgroundColor: '#e74c3c', marginTop: '5px'}}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TorrentsTab;
