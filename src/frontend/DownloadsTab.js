import React, { useState, useEffect, useCallback } from "react";

function DownloadsTab({ displayAppMessage }) {
  const [downloads, setDownloads] = useState([]);
  const [newUrl, setNewUrl] = useState("");
  const [localError, setLocalError] = useState(""); // For form validation errors
  // Removed local 'message' state, will use displayAppMessage for success/global error messages

  const [downloadProgressState, setDownloadProgressState] = useState({});

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
                // Allow 0 speed if no new bytes but time passed
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
                }; // Keep old speed if not enough data
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
            // Keep speed for a short while after completion for visibility, or clear if errored
            if (
              d.status === "error" ||
              Date.now() - (newProgressState[d.id]?.lastVisibleTime || 0) > 5000
            ) {
              // Clear after 5s for completed
              delete newProgressState[d.id];
            } else if (
              d.status === "completed" &&
              !newProgressState[d.id]?.lastVisibleTime
            ) {
              newProgressState[d.id].lastVisibleTime = Date.now(); // Mark time for completed speed visibility
            }
          }
        });
        setDownloadProgressState(newProgressState);
        setDownloads(data);
        if (!isInitialFetch) setLocalError(""); // Clear local errors on successful fetch unless it's the very first one
      } catch (e) {
        console.error("Failed to fetch downloads:", e);
        // Use displayAppMessage for persistent fetch errors, or localError for transient ones
        if (isInitialFetch)
          displayAppMessage("Failed to load downloads. " + e.message, "error");
        else setLocalError("Failed to update downloads list. " + e.message);
      }
    },
    [downloadProgressState, displayAppMessage]
  );

  useEffect(() => {
    fetchDownloads(true); // Pass true for initial fetch
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
    return filePath.substring(filePath.lastIndexOf("/") + 1);
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0)
      return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0 || i >= sizes.length) return "0 Bytes"; // Handle edge cases like log(negative) or too small/large
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

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
            placeholder="Enter magnet link or URL to .torrent/.nzb file"
            style={{ width: "calc(100% - 120px)", marginRight: "10px" }} // Adjust width based on button
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
      {downloads.length === 0 ? (
        <p>No active or recent downloads.</p>
      ) : (
        <ul>
          {downloads.map((d) => (
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
                        ({formatBytes(d.downloadedBytes)} downloaded, total size
                        unknown)
                      </span>
                    )}
                </p>
                <p>
                  <strong>File Path:</strong> {formatPath(d.filePath)}
                </p>
                {d.extractedPath && (
                  <p>
                    <strong>Extracted to:</strong> {formatPath(d.extractedPath)}
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
          ))}
        </ul>
      )}
    </div>
  );
}

export default DownloadsTab;
