import React, { useState, useEffect, useCallback } from "react";

function FilesTab({ displayAppMessage }) {
  const [files, setFiles] = useState([]);
  const [storageInfo, setStorageInfo] = useState(null);
  const [localError, setLocalError] = useState("");
  const [localMessage, setLocalMessage] = useState(""); // For non-critical, tab-specific messages
  const [mediaInfo, setMediaInfo] = useState({});
  const [currentPath, setCurrentPath] = useState("");
  const [isUnarchiving, setIsUnarchiving] = useState({});

  const clearMessages = () => {
    setLocalError("");
    setLocalMessage("");
  };

  const fetchFiles = useCallback(async (pathToFetch) => {
    clearMessages();
    try {
      const response = await fetch(
        `/api/files/download_contents?path=${encodeURIComponent(pathToFetch)}`
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setFiles(data);
    } catch (e) {
      console.error("Failed to fetch files:", e);
      setLocalError(
        `Failed to load files for "${pathToFetch || "/"}". ${e.message}`
      );
      setFiles([]);
    }
  }, []);

  const fetchStorageInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/files/space");
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setStorageInfo(data);
    } catch (e) {
      console.error("Failed to fetch storage info:", e);
      // Not setting localError for this as it's less critical than file listing
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentPath);
    fetchStorageInfo();
    const intervalId = setInterval(() => {
      fetchFiles(currentPath);
      fetchStorageInfo();
    }, 10000);
    return () => clearInterval(intervalId);
  }, [currentPath, fetchFiles, fetchStorageInfo]);

  const handleDeleteFile = async (itemRelativePath, itemName) => {
    clearMessages();
    if (
      !window.confirm(
        `Are you sure you want to delete "${itemName}"? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const response = await fetch("/api/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemPath: itemRelativePath }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      displayAppMessage(
        data.message || "Item deleted successfully.",
        "success"
      );
      fetchFiles(currentPath);
      setMediaInfo((prev) => {
        const newState = { ...prev };
        delete newState[itemRelativePath];
        return newState;
      });
    } catch (e) {
      console.error("Failed to delete item:", e);
      displayAppMessage("Failed to delete item. " + e.message, "error");
    }
  };

  const handleUnarchive = async (itemRelativePath, itemName) => {
    clearMessages();
    setIsUnarchiving((prev) => ({ ...prev, [itemRelativePath]: true }));
    try {
      const response = await fetch("/api/files/unarchive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemPath: itemRelativePath }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to unarchive.");
      }
      displayAppMessage(
        data.message || `Successfully unarchived ${itemName}.`,
        "success"
      );
      fetchFiles(currentPath);
    } catch (e) {
      console.error("Failed to unarchive:", e);
      displayAppMessage(
        `Failed to unarchive ${itemName}: ${e.message}`,
        "error"
      );
    } finally {
      setIsUnarchiving((prev) => ({ ...prev, [itemRelativePath]: false }));
    }
  };

  const handleMatchImdb = async (item) => {
    const key = item.relativePath;
    clearMessages();
    setMediaInfo((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      const response = await fetch(
        `/api/media/match/${encodeURIComponent(item.name)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      if (Object.keys(data).length === 0) {
        // Check if data is an empty object
        setMediaInfo((prev) => ({
          ...prev,
          [key]: { error: "No IMDB info found.", title: "No info found" },
        }));
      } else {
        setMediaInfo((prev) => ({ ...prev, [key]: data }));
      }
    } catch (e) {
      console.error("Failed to match IMDB:", e);
      setMediaInfo((prev) => ({ ...prev, [key]: { error: e.message } }));
    }
  };

  const handleItemClick = (item) => {
    if (item.type === "folder" || item.type === "parent") {
      setCurrentPath(item.relativePath);
      setFiles([]);
      clearMessages();
    }
  };

  const handleItemKeyPress = (event, item) => {
    if (event.key === "Enter" || event.key === " ") {
      handleItemClick(item);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0)
      return "N/A";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div>
      <h2>File Management (Downloads Directory)</h2>

      {localError && (
        <p className="message error" style={{ marginBottom: "15px" }}>
          {localError}
        </p>
      )}
      {localMessage && (
        <p className="message success" style={{ marginBottom: "15px" }}>
          {localMessage}
        </p>
      )}

      {storageInfo && (
        <div className="storage-info" style={{ marginBottom: "20px" }}>
          <strong>
            Storage ({storageInfo.mountedOn || storageInfo.filesystem || "N/A"}
            ):
          </strong>
          Total: {storageInfo.total}, Used: {storageInfo.used} (
          {storageInfo.usePercent}), Free: {storageInfo.free}
        </div>
      )}

      <h3>Files and Folders in: /downloads/{currentPath || ""}</h3>
      {files.length === 0 && !localError && (
        <p>Loading or directory is empty...</p>
      )}

      {files.length > 0 && (
        <ul>
          {files.map((item) => (
            <li
              key={item.relativePath || item.name}
              className={`file-item type-${item.type}`}
              onClick={() =>
                item.type === "folder" || item.type === "parent"
                  ? handleItemClick(item)
                  : null
              }
              onKeyDown={(e) =>
                item.type === "folder" || item.type === "parent"
                  ? handleItemKeyPress(e, item)
                  : null
              }
              role={
                item.type === "folder" || item.type === "parent"
                  ? "button"
                  : undefined
              }
              tabIndex={
                item.type === "folder" || item.type === "parent" ? 0 : undefined
              }
              style={{
                cursor:
                  item.type === "folder" || item.type === "parent"
                    ? "pointer"
                    : "default",
              }}
            >
              <p>
                <strong>Name:</strong> {item.name} ({item.type})
              </p>
              {item.type !== "parent" && (
                <p>
                  <strong>Size:</strong> {formatSize(item.size)}
                </p>
              )}
              {item.type !== "parent" && (
                <p>
                  <strong>Created:</strong>{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              )}

              {(item.type === "file" || item.type === "folder") && (
                <div className="actions-group" style={{ marginTop: "10px" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMatchImdb(item);
                    }}
                    disabled={
                      isUnarchiving[item.relativePath] ||
                      (mediaInfo[item.relativePath] &&
                        mediaInfo[item.relativePath].loading)
                    }
                    style={{ marginRight: "5px", marginBottom: "5px" }}
                  >
                    {mediaInfo[item.relativePath] &&
                    mediaInfo[item.relativePath].loading
                      ? "Matching..."
                      : "Match IMDB"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sessionStorage.setItem(
                        "torrentSourcePath",
                        item.relativePath
                      );
                      sessionStorage.setItem(
                        "torrentSourceNameSuggestion",
                        item.name
                      );
                      displayAppMessage(
                        `Set "${item.name}" as source for new torrent. Go to Torrents tab.`,
                        "success"
                      );
                    }}
                    disabled={isUnarchiving[item.relativePath]}
                    style={{ marginRight: "5px", marginBottom: "5px" }}
                  >
                    Use for New Torrent
                  </button>
                  {item.type === "file" &&
                    [".zip", ".rar", ".tar.gz", ".tar"].some((ext) =>
                      item.name.toLowerCase().endsWith(ext)
                    ) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnarchive(item.relativePath, item.name);
                        }}
                        disabled={isUnarchiving[item.relativePath]}
                        style={{ marginRight: "5px", marginBottom: "5px" }}
                      >
                        {isUnarchiving[item.relativePath]
                          ? "Unarchiving..."
                          : "Unarchive"}
                      </button>
                    )}
                  {item.type !== "parent" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(item.relativePath, item.name);
                      }}
                      className="danger"
                      style={{ marginBottom: "5px" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}

              {mediaInfo[item.relativePath] &&
                !mediaInfo[item.relativePath].loading &&
                (mediaInfo[item.relativePath].title ||
                  mediaInfo[item.relativePath].error) && (
                  <div
                    className="media-info-container"
                    style={{
                      marginTop: "10px",
                      paddingLeft: "15px",
                      borderLeft: "2px solid #00b8ff",
                    }}
                  >
                    {mediaInfo[item.relativePath].error && (
                      <p className="message error">
                        {mediaInfo[item.relativePath].error}
                      </p>
                    )}
                    {mediaInfo[item.relativePath].title &&
                      mediaInfo[item.relativePath].title !==
                        "No info found" && (
                        <>
                          <h4>
                            {mediaInfo[item.relativePath].title} (
                            {mediaInfo[item.relativePath].year})
                          </h4>
                          {mediaInfo[item.relativePath].posterUrl &&
                            mediaInfo[item.relativePath].posterUrl !==
                              "N/A" && (
                              <img
                                src={mediaInfo[item.relativePath].posterUrl}
                                alt={`Poster for ${
                                  mediaInfo[item.relativePath].title
                                }`}
                                style={{
                                  maxWidth: "100px",
                                  maxHeight: "150px",
                                  float: "left",
                                  marginRight: "10px",
                                  marginBottom: "5px",
                                  borderRadius: "3px",
                                }}
                              />
                            )}
                          <p>
                            <strong>Rating:</strong>{" "}
                            {mediaInfo[item.relativePath].rating || "N/A"}
                          </p>
                          <p>
                            <strong>Genres:</strong>{" "}
                            {mediaInfo[item.relativePath].genres
                              ? mediaInfo[item.relativePath].genres.join(", ")
                              : "N/A"}
                          </p>
                          <p style={{ clear: "both" }}>
                            <strong>Plot:</strong>{" "}
                            {mediaInfo[item.relativePath].plot || "N/A"}
                          </p>
                          {/* <div style={{clear: 'both'}}></div> Ensure plot is cleared if poster is tall*/}
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
