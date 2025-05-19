import React, { useState, useEffect, useCallback } from "react";

function DownloadsTab({ displayAppMessage }) {
  const [downloads, setDownloads] = useState([]);
  const [newUrl, setNewUrl] = useState("");
  const [localError, setLocalError] = useState(""); // For form validation errors
  const [downloadProgressState, setDownloadProgressState] = useState({});
  const [searchQuery, setSearchQuery] = useState(""); // Added for search functionality

  const fetchDownloads = useCallback(
    async (isInitialFetch = false) => {
      try {
        const response = await fetch("/api/downloads");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        const newProgressState = { ...downloadProgressState };
        data.forEach((d) => {
          if (d.status === "downloading" && d.downloadedBytes !== undefined) {
            const prev = downloadProgressState[d.id];
            const currentTime = Date.now();
            if (
              prev &&
              prev.prevBytes !== undefined &&
              prev.prevTime !== undefined
            ) {
              const timeDiffSeconds = (currentTime - prev.prevTime) / 1000;
              const bytesDiff = d.downloadedBytes - prev.prevBytes;
              if (timeDiffSeconds > 0 && bytesDiff >= 0) {
                const speed = bytesDiff / timeDiffSeconds;
                newProgressState[d.id] = {
                  ...prev,
                  speed: speed,
                  prevBytes: d.downloadedBytes,
                  prevTime: currentTime,
                };
              } else {
                newProgressState[d.id] = {
                  ...prev,
                  prevBytes: d.downloadedBytes,
                  prevTime: currentTime,
                };
              }
            } else {
              newProgressState[d.id] = {
                prevBytes: d.downloadedBytes,
                prevTime: currentTime,
                speed: 0,
              };
            }
          } else if (
            newProgressState[d.id] &&
            (d.status === "completed" || d.status === "error")
          ) {
            if (
              d.status === "error" ||
              Date.now() - (newProgressState[d.id]?.lastVisibleTime || 0) > 5000
            ) {
              delete newProgressState[d.id];
            } else if (
              d.status === "completed" &&
              !newProgressState[d.id]?.lastVisibleTime
            ) {
              newProgressState[d.id].lastVisibleTime = Date.now();
            }
          }
        });
        setDownloadProgressState(newProgressState);
        setDownloads(data);
        if (!isInitialFetch) setLocalError("");
      } catch (e) {
        console.error("Failed to fetch downloads:", e);
        if (isInitialFetch)
          displayAppMessage("Failed to load downloads. " + e.message, "error");
        else setLocalError("Failed to update downloads list. " + e.message);
      }
    },
    [downloadProgressState, displayAppMessage] // Added displayAppMessage to dependency array
  );

  useEffect(() => {
    fetchDownloads(true);
    const intervalId = setInterval(() => fetchDownloads(false), 2000);
    return () => clearInterval(intervalId);
  }, [fetchDownloads]);

  const handleAddDownload = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (!newUrl.trim()) {
      setLocalError("Please enter a URL.");
      return;
    }
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      displayAppMessage(
        data.message || "Download started successfully.",
        "success"
      );
      setNewUrl("");
      fetchDownloads();
    } catch (e) {
      console.error("Failed to add download:", e);
      displayAppMessage("Failed to add download. " + e.message, "error");
    }
  };

  const handleDeleteDownload = async (id) => {
    setLocalError("");
    if (
      !window.confirm(
        "Are you sure you want to delete this download and its files?"
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/downloads/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      displayAppMessage(
        data.message || "Download deleted successfully.",
        "success"
      );
      fetchDownloads();
    } catch (e) {
      console.error("Failed to delete download:", e);
      displayAppMessage("Failed to delete download. " + e.message, "error");
    }
  };

  const formatPath = (filePath) => {
    if (!filePath) return "N/A";
    const downloadsDirMarker = "/downloads/";
    const idx = filePath.lastIndexOf(downloadsDirMarker);
    if (idx !== -1) {
      return filePath.substring(idx + downloadsDirMarker.length);
    }
    // Fallback for paths not containing /downloads/ or if it's the root itself
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash === -1) return filePath; // No slashes, return as is
    return filePath.substring(lastSlash + 1) || filePath; // Return part after last slash, or full path if ends with /
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0)
      return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0 || i >= sizes.length) return "0 Bytes";
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Filter downloads based on search query
  const filteredDownloads = downloads.filter((d) => {
    const searchTerm = searchQuery.toLowerCase();
    const urlMatch = d.url && d.url.toLowerCase().includes(searchTerm);
    const filePathMatch =
      d.filePath && formatPath(d.filePath).toLowerCase().includes(searchTerm);
    const statusMatch = d.status && d.status.toLowerCase().includes(searchTerm);
    return urlMatch || filePathMatch || statusMatch;
  });

  return (
    <div>
      <h2>Download Management</h2>
      <form onSubmit={handleAddDownload} style={{ marginBottom: "20px" }}>
        <div className="form-group">
          <label
            htmlFor="downloadUrl"
            style={{ display: "block", marginBottom: "5px" }}
          >
            Download URL:
          </label>
          <input
            type="url"
            id="downloadUrl"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Enter magnet link or URL to .torrent/.nzb file" // This placeholder might need update based on actual backend capabilities
            style={{ width: "calc(100% - 120px)", marginRight: "10px" }}
            required
          />
          <button type="submit" style={{ width: "110px" }}>
            Add Download
          </button>
        </div>
      </form>
      {localError && (
        <p className="message error" style={{ marginBottom: "15px" }}>
          {localError}
        </p>
      )}

      <h3>Current Downloads</h3>
      {/* Search Input */}
      <div className="form-group" style={{ marginBottom: "15px" }}>
        <input
          type="text"
          placeholder="Search downloads (URL, filename, status)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />
      </div>

      {filteredDownloads.length === 0 ? (
        <p>
          {searchQuery
            ? "No downloads match your search."
            : "No active or recent downloads."}
        </p>
      ) : (
        <ul>
          {filteredDownloads.map(
            (
              d // Use filteredDownloads here
            ) => (
              <li key={d.id} className="download-item">
                <div className="download-item-details">
                  <p>
                    <strong>URL:</strong> {d.url}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className={`status-${d.status.toLowerCase()}`}>
                      {d.status}
                    </span>
                    {d.status === "downloading" && d.totalBytes > 0 && (
                      <span>
                        {" (" + formatBytes(d.downloadedBytes)} /{" "}
                        {formatBytes(d.totalBytes)} -
                        {((d.downloadedBytes / d.totalBytes) * 100).toFixed(1)}%
                        {downloadProgressState[d.id] &&
                          downloadProgressState[d.id].speed > 0 &&
                          ` - ${formatBytes(
                            downloadProgressState[d.id].speed
                          )}/s`}
                        {downloadProgressState[d.id] &&
                          downloadProgressState[d.id].speed === 0 &&
                          d.downloadedBytes > 0 &&
                          ` - (stalled)`}
                        )
                      </span>
                    )}
                    {d.status === "downloading" &&
                      d.totalBytes === 0 &&
                      d.downloadedBytes > 0 && (
                        <span>
                          {" "}
                          ({formatBytes(d.downloadedBytes)} downloaded, total
                          size unknown)
                        </span>
                      )}
                  </p>
                  <p>
                    <strong>File Path:</strong> {formatPath(d.filePath)}
                  </p>
                  {d.extractedPath && (
                    <p>
                      <strong>Extracted to:</strong>{" "}
                      {formatPath(d.extractedPath)}
                    </p>
                  )}
                  <p>
                    <strong>Queued:</strong>{" "}
                    {new Date(d.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="actions-group" style={{ marginTop: "10px" }}>
                  <button
                    onClick={() => handleDeleteDownload(d.id)}
                    className="danger"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

export default DownloadsTab;
