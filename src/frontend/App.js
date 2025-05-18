import React, { useState, useEffect, useCallback } from "react";
import DownloadsTab from "./DownloadsTab";
import TorrentsTab from "./TorrentsTab";
import FilesTab from "./FilesTab";
import LoginForm from "./LoginForm"; // Import LoginForm

function App() {
  const [activeTab, setActiveTab] = useState("downloads");
  const [appMessage, setAppMessage] = useState(""); // General app messages
  const [appMessageType, setAppMessageType] = useState("success"); // 'success' or 'error'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const displayMessage = (msg, type = "success", duration = 3000) => {
    setAppMessage(msg);
    setAppMessageType(type);
    if (duration) {
      setTimeout(() => {
        setAppMessage("");
      }, duration);
    }
  };

  const checkAuthStatus = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const response = await fetch("/api/auth/status");
      const data = await response.json();
      if (response.ok && data.isAuthenticated) {
        setIsAuthenticated(true);
        setCurrentUser(data.username);
        // displayMessage(`Welcome, ${data.username}!`); // Welcome message can be optional here or shown differently
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsAuthenticated(false);
      setCurrentUser(null);
      displayMessage("Error connecting to server for auth check.", "error");
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
    displayMessage(`Welcome, ${username}!`, "success");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Error during logout:", error);
      // Still log out on client-side
    } finally {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setActiveTab("downloads"); // Reset to a default tab
      displayMessage("You have been logged out.", "success");
      // Clear any session-specific data if needed, e.g., sessionStorage.clear();
    }
  };

  if (isLoadingAuth) {
    // You can replace this with a more sophisticated loading spinner component if you have one
    return (
      <div style={{ textAlign: "center", padding: "50px", fontSize: "1.2em" }}>
        Loading application...
      </div>
    );
  }

  if (!isAuthenticated) {
    // The LoginForm has its own message display for login errors
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "downloads":
        return <DownloadsTab displayAppMessage={displayMessage} />;
      case "torrents":
        return <TorrentsTab displayAppMessage={displayMessage} />;
      case "files":
        return <FilesTab displayAppMessage={displayMessage} />;
      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    // The main container is styled by #root in style.css
    <>
      <header className="app-header">
        <h1>VPS Torrent Manager</h1>
        <div className="user-info">
          {currentUser && (
            <span style={{ marginRight: "15px" }}>User: {currentUser}</span>
          )}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {appMessage && (
        <p
          className={`message ${
            appMessageType === "error" ? "error" : "success"
          }`}
        >
          {appMessage}
        </p>
      )}

      <div className="tabs">
        <button
          className={activeTab === "downloads" ? "active" : ""}
          onClick={() => setActiveTab("downloads")}
        >
          Downloads
        </button>
        <button
          className={activeTab === "torrents" ? "active" : ""}
          onClick={() => setActiveTab("torrents")}
        >
          Torrents
        </button>
        <button
          className={activeTab === "files" ? "active" : ""}
          onClick={() => setActiveTab("files")}
        >
          Files
        </button>
      </div>
      <main className="tab-content">{renderTabContent()}</main>
    </>
  );
}

export default App;
