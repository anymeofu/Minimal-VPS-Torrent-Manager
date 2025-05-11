import React, { useState, useEffect, useCallback } from 'react';
import DownloadsTab from './DownloadsTab';
import TorrentsTab from './TorrentsTab';
import FilesTab from './FilesTab';
import LoginForm from './LoginForm'; // Import LoginForm

function App() {
  const [activeTab, setActiveTab] = useState('downloads');
  const [appMessage, setAppMessage] = useState(''); // General app messages
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const checkAuthStatus = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      if (response.ok && data.isAuthenticated) {
        setIsAuthenticated(true);
        setCurrentUser(data.username);
        setAppMessage(`Welcome, ${data.username}!`);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
        // No specific message needed here, LoginForm will show
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setAppMessage('Error connecting to server for auth check.');
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleLoginSuccess = (username) => {
    setIsAuthenticated(true);
    setCurrentUser(username);
    setAppMessage(`Welcome, ${username}!`);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Error during logout:', error);
      // Still log out on client-side
    } finally {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setAppMessage('You have been logged out.');
      // Clear any session-specific data if needed, e.g., sessionStorage.clear();
    }
  };
  
  if (isLoadingAuth) {
    return <div>Loading application...</div>;
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'downloads':
        return <DownloadsTab />;
      case 'torrents':
        return <TorrentsTab />;
      case 'files':
        return <FilesTab />;
      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
        <h1>VPS Torrent Manager</h1>
        <div>
          {currentUser && <span style={{ marginRight: '15px' }}>Logged in as: {currentUser}</span>}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
      {appMessage && <p style={{textAlign: 'center', color: appMessage.startsWith('Error') ? '#e74c3c' : '#2ecc71'}}>{appMessage}</p>}
      
      <div className="tabs">
        <button 
          className={activeTab === 'downloads' ? 'active' : ''}
          onClick={() => setActiveTab('downloads')}
        >
          Downloads
        </button>
        <button 
          className={activeTab === 'torrents' ? 'active' : ''}
          onClick={() => setActiveTab('torrents')}
        >
          Torrents
        </button>
        <button 
          className={activeTab === 'files' ? 'active' : ''}
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
      </div>
      <div className="tab-content">
        {renderTabContent()}
      </div>
      {/* Storage info is now part of FilesTab, this can be removed or kept if global display is desired */}
      {/* <div className="storage-info">
        Storage: Loading... 
      </div> */}
    </div>
  );
}

export default App;
