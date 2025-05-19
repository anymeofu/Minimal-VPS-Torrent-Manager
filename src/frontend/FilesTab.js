import React, { useState, useEffect, useCallback } from "react";

function FilesTab({ displayAppMessage }) {
  const [files, setFiles] = useState([]);
  const [storageInfo, setStorageInfo] = useState(null);
  const [localError, setLocalError] = useState("");
  // const [localMessage, setLocalMessage] = useState(""); // Replaced by displayAppMessage for consistency
  const [mediaInfo, setMediaInfo] = useState({});
  const [currentPath, setCurrentPath] = useState("");
  const [isUnarchiving, setIsUnarchiving] = useState({});
  const [searchQuery, setSearchQuery] = useState(""); // Added for search functionality

  const clearMessages = () => {
    setLocalError("");
    // setLocalMessage(""); // displayAppMessage handles success/info messages globally
  };

  const fetchFiles = useCallback(
    async (pathToFetch) => {
      clearMessages();
      try {
        const response = await fetch(
          `/api/files/download_contents?path=${encodeURIComponent(pathToFetch)}`
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error || `HTTP error! status: ${response.status}`
          );
        }
        const data = await response.json();
        setFiles(data);
      } catch (e) {
        console.error("Failed to fetch files:", e);
        setLocalError(
          `Failed to load files for "${pathToFetch || "/"}". ${e.message}`
        );
        setFiles([]); // Clear files on error
      }
    },
    [] // Removed fetchFiles from its own dependency array which is incorrect.
    // Dependencies should be external values it closes over.
  );

  const fetchStorageInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/files/space");
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `HTTP error! status: ${response.status}`
        );
      }
      const data = await response.json();
      setStorageInfo(data);
    } catch (e) {
      console.error("Failed to fetch storage info:", e);
      // Optionally, display a non-critical error for storage info
      // displayAppMessage(`Could not load storage info: ${e.message}`, "error");
    }
  }, []); // Removed displayAppMessage if not used here, or add if used.

  useEffect(() => {
    fetchFiles(currentPath);
    fetchStorageInfo();
    // Removed polling interval for files and storage for this example
    // If you need polling, ensure dependencies are correct or use a different strategy
    // For example, fetchFiles could be recalled after certain actions (delete, unarchive)
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
      fetchFiles(currentPath); // Refresh file list
      fetchStorageInfo(); // Refresh storage info
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
      fetchFiles(currentPath); // Refresh file list
      fetchStorageInfo(); // Storage might change
    } catch (e) {
      console.error("Failed to unarchive:", e);
      displayAppMessage(
        `Failed to unarchive ${itemName}: ${e.message}`,
        "error"
      );
    } finally {
      setIsUnarchiving((prev) => {
        const newState = { ...prev };
        delete newState[itemRelativePath]; // More robust way to remove the key
        return newState;
      });
    }
  };

  const handleMatchImdb = async (item) => {
    const key = item.relativePath;
    clearMessages();
    setMediaInfo((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      // Assuming item.name is the filename/foldername to match
      const response = await fetch(
        `/api/media/match/${encodeURIComponent(item.name)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      if (Object.keys(data).length === 0 || data.Response === "False") {
        setMediaInfo((prev) => ({
          ...prev,
          [key]: {
            error: data.Error || "No IMDB info found.",
            title: "No info found",
          },
        }));
      } else {
        setMediaInfo((prev) => ({ ...prev, [key]: data }));
      }
    } catch (e) {
      console.error("Failed to match IMDB:", e);
      setMediaInfo((prev) => ({
        ...prev,
        [key]: { error: e.message, title: "Error matching" },
      }));
    }
  };

  const handleItemClick = (item) => {
    if (item.type === "folder" || item.type === "parent") {
      setCurrentPath(item.relativePath);
      setFiles([]); // Clear old files before fetching new ones
      setSearchQuery(""); // Clear search when navigating
      clearMessages();
    }
  };

  const handleItemKeyPress = (event, item) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); // Prevent spacebar scroll
      handleItemClick(item);
    }
  };

  const handleDownloadFile = (itemRelativePath, itemName) => {
    // Construct the URL based on the /serve_file/ route
    // The README mentions: /serve_file/<path_to_file_in_downloads>
    // itemRelativePath should be the <path_to_file_in_downloads>
    const downloadUrl = `/serve_file/${encodeURIComponent(itemRelativePath)}`;

    // To ensure the browser treats it as a download, especially for viewable file types,
    // it's often better to use an anchor tag with a download attribute.
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", itemName); // Suggests a filename to the browser
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    displayAppMessage(`Preparing download for ${itemName}...`, "success");
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

  // Filter files based on search query
  const filteredFiles = files.filter((item) => {
    if (!searchQuery) return true; // No query, show all
    return item.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div>
      <h2>File Management (Downloads Directory)</h2>

      {localError && (
        <p className="message error" style={{ marginBottom: "15px" }}>
          {localError}
        </p>
      )}
      {/* Removed localMessage, displayAppMessage is used globally */}

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

      {/* Search Input */}
      <div className="form-group" style={{ marginBottom: "15px" }}>
        <input
          type="text"
          placeholder="Search files/folders in current directory..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />
      </div>

      {filteredFiles.length === 0 && !localError && (
        <p>
          {searchQuery
            ? "No items match your search."
            : "Loading or directory is empty..."}
        </p>
      )}

      {filteredFiles.length > 0 && (
        <ul>
          {filteredFiles.map((item) => (
            <li
              key={item.relativePath || item.name} // Ensure unique key
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
                marginBottom: "15px", // Added for better spacing
                paddingBottom: "10px", // Added for better spacing
                borderBottom: "1px solid #333", // Separator
              }}
            >
              <p>
                <strong>Name:</strong> {item.name}{" "}
                <span style={{ color: "#aaa" }}>({item.type})</span>
              </p>
              {item.type !== "parent" && (
                <p>
                  <strong>Size:</strong> {formatSize(item.size)}
                </p>
              )}
              {item.type !== "parent" &&
                item.createdAt && ( // Check if createdAt exists
                  <p>
                    <strong>Created:</strong>{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                )}

              {(item.type === "file" || item.type === "folder") && (
                <div className="actions-group" style={{ marginTop: "10px" }}>
                  {/* Download Button - only for files */}
                  {item.type === "file" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent li click event
                        handleDownloadFile(item.relativePath, item.name);
                      }}
                      disabled={isUnarchiving[item.relativePath]}
                      style={{ marginRight: "5px", marginBottom: "5px" }}
                    >
                      Download File
                    </button>
                  )}
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
                  {item.type !== "parent" && ( // Delete button should not be for ".."
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
                      borderLeft: "2px solid #00b8ff", // Retro blue accent
                    }}
                  >
                    {mediaInfo[item.relativePath].error && (
                      <p className="message error">
                        {mediaInfo[item.relativePath].error}
                      </p>
                    )}
                    {mediaInfo[item.relativePath].title &&
                      mediaInfo[item.relativePath].title !==
                        "No info found" && ( // Check against actual message from API
                        <>
                          <h4>
                            {mediaInfo[item.relativePath].Title ||
                              mediaInfo[item.relativePath].title}{" "}
                            (
                            {mediaInfo[item.relativePath].Year ||
                              mediaInfo[item.relativePath].year}
                            )
                          </h4>
                          {(mediaInfo[item.relativePath].Poster ||
                            mediaInfo[item.relativePath].posterUrl) &&
                            (mediaInfo[item.relativePath].Poster ||
                              mediaInfo[item.relativePath].posterUrl) !==
                              "N/A" && (
                              <img
                                src={
                                  mediaInfo[item.relativePath].Poster ||
                                  mediaInfo[item.relativePath].posterUrl
                                }
                                alt={`Poster for ${
                                  mediaInfo[item.relativePath].Title ||
                                  mediaInfo[item.relativePath].title
                                }`}
                                style={{
                                  maxWidth: "100px",
                                  maxHeight: "150px",
                                  float: "left",
                                  marginRight: "10px",
                                  marginBottom: "5px",
                                  borderRadius: "3px",
                                  border: "1px solid #222", // Subtle border
                                }}
                              />
                            )}
                          <p>
                            <strong>Rating:</strong>{" "}
                            {mediaInfo[item.relativePath].imdbRating ||
                              mediaInfo[item.relativePath].rating ||
                              "N/A"}
                          </p>
                          <p>
                            <strong>Genres:</strong>{" "}
                            {mediaInfo[item.relativePath].Genre ||
                              (mediaInfo[item.relativePath].genres
                                ? mediaInfo[item.relativePath].genres.join(", ")
                                : "N/A")}
                          </p>
                          <p style={{ clear: "both" }}>
                            <strong>Plot:</strong>{" "}
                            {mediaInfo[item.relativePath].Plot ||
                              mediaInfo[item.relativePath].plot ||
                              "N/A"}
                          </p>
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
