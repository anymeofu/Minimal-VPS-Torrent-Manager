import React, { useState, useEffect, useCallback } from "react";

function TorrentsTab({ displayAppMessage }) {
  const [torrents, setTorrents] = useState([]);
  const [localError, setLocalError] = useState(""); // For form validation errors
  // Removed local 'message' state, using displayAppMessage now.
  const [isCreatingTorrent, setIsCreatingTorrent] = useState(false);

  const [sourcePath, setSourcePath] = useState("");
  const [torrentName, setTorrentName] = useState("");
  const [webseeds, setWebseeds] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [announceList, setAnnounceList] = useState("");

  useEffect(() => {
    const preselectedPath = sessionStorage.getItem("torrentSourcePath");
    const nameSuggestion = sessionStorage.getItem(
      "torrentSourceNameSuggestion"
    );
    let infoMessage = "";

    if (preselectedPath) {
      setSourcePath(preselectedPath);
      sessionStorage.removeItem("torrentSourcePath"); // Clear after use
      infoMessage += `Source path "${preselectedPath}" pre-filled. `;
    }

    if (nameSuggestion) {
      const suggestedName = nameSuggestion;
      setTorrentName(suggestedName);
      sessionStorage.removeItem("torrentSourceNameSuggestion"); // Clear after use
      infoMessage += `Torrent name "${suggestedName}" suggested.`;
    }

    if (infoMessage) {
      displayAppMessage(infoMessage.trim(), "success", 5000); // Show for 5 seconds
    }
  }, [displayAppMessage]);

  const fetchTorrents = useCallback(
    async (isInitialFetch = false) => {
      try {
        const response = await fetch("/api/torrents");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setTorrents(data);
        if (!isInitialFetch) setLocalError(""); // Clear local errors on successful fetch
      } catch (e) {
        console.error("Failed to fetch torrents:", e);
        if (isInitialFetch)
          displayAppMessage("Failed to load torrents. " + e.message, "error");
        else setLocalError("Failed to update torrents list. " + e.message);
      }
    },
    [displayAppMessage]
  );

  useEffect(() => {
    fetchTorrents(true);
    const intervalId = setInterval(() => fetchTorrents(false), 7000);
    return () => clearInterval(intervalId);
  }, [fetchTorrents]);

  const handleCreateTorrent = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (!sourcePath.trim() || !torrentName.trim()) {
      setLocalError("Source Path and Torrent Name are required.");
      return;
    }
    setIsCreatingTorrent(true);

    const payload = {
      sourcePath: sourcePath.trim(),
      name: torrentName.trim(),
      isPrivate: isPrivate,
      webseeds: webseeds
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
      announceList: announceList
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
    };

    try {
      const response = await fetch("/api/torrents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      displayAppMessage(
        data.message || "Torrent created successfully.",
        "success"
      );
      // Clear form
      setSourcePath("");
      setTorrentName("");
      setWebseeds("");
      setIsPrivate(false);
      setAnnounceList("");
      fetchTorrents();
    } catch (e) {
      console.error("Failed to create torrent:", e);
      displayAppMessage("Failed to create torrent. " + e.message, "error");
    } finally {
      setIsCreatingTorrent(false);
    }
  };

  const handleDeleteTorrent = async (id) => {
    setLocalError("");
    if (
      !window.confirm(
        "Are you sure you want to delete this torrent record and its .torrent file?"
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/torrents/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      displayAppMessage(
        data.message || "Torrent deleted successfully.",
        "success"
      );
      fetchTorrents();
    } catch (e) {
      console.error("Failed to delete torrent:", e);
      displayAppMessage("Failed to delete torrent. " + e.message, "error");
    }
  };

  const handleDownloadTorrentFile = (id) => {
    window.location.href = `/api/torrents/${id}/file`;
  };

  const formatTorrentSourcePath = (sP) => {
    if (!sP) return "N/A";
    return sP;
  };

  return (
    <div>
      <h2>Torrent Management</h2>

      <h3>Create New Torrent</h3>
      <form onSubmit={handleCreateTorrent} style={{ marginBottom: "30px" }}>
        <div className="form-group">
          <label htmlFor="sourcePath">
            Source Path (relative to downloads dir, e.g., "myFile.mp4" or
            "myFolder"):
          </label>
          <input
            type="text"
            id="sourcePath"
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            placeholder="e.g., media/movie.mkv or archives/collection.zip"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="torrentName">Torrent Name:</label>
          <input
            type="text"
            id="torrentName"
            value={torrentName}
            onChange={(e) => setTorrentName(e.target.value)}
            placeholder="My Awesome Release"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="webseeds">
            Webseeds (comma-separated URLs, optional):
          </label>
          <input
            type="text"
            id="webseeds"
            value={webseeds}
            onChange={(e) => setWebseeds(e.target.value)}
            placeholder="http://example.com/seed1, http://example.com/seed2"
          />
        </div>
        {sourcePath &&
          !sourcePath.endsWith("/") &&
          !sourcePath.endsWith("\\") && (
            <button
              type="button"
              onClick={() => {
                const webseedUrl = `${window.location.origin}/serve_file/${sourcePath}`; // Ensure this path is correct for your public file serving
                setWebseeds((prev) =>
                  prev
                    ? `${prev
                        .split(",")
                        .map((s) => s.trim())
                        .filter((s) => s !== webseedUrl)
                        .join(", ")}, ${webseedUrl}`
                    : webseedUrl
                );
                displayAppMessage(
                  "Self webseed URL added/updated.",
                  "success",
                  2000
                );
              }}
              style={{ marginBottom: "10px", marginRight: "10px" }}
            >
              Suggest Self as Webseed
            </button>
          )}
        <div className="form-group">
          <label htmlFor="announceList">
            Trackers (comma-separated, optional, defaults will be used if
            empty):
          </label>
          <input
            type="text"
            id="announceList"
            value={announceList}
            onChange={(e) => setAnnounceList(e.target.value)}
            placeholder="udp://tracker.opentrackr.org:1337/announce, udp://tracker.openbittorrent.com:6969/announce"
          />
        </div>

        <div className="form-check" style={{ marginBottom: "15px" }}>
          <input
            type="checkbox"
            id="isPrivate"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <label htmlFor="isPrivate">Private Torrent</label>
        </div>
        <button type="submit" disabled={isCreatingTorrent}>
          {isCreatingTorrent ? "Creating..." : "Create Torrent"}
        </button>
      </form>

      {isCreatingTorrent && (
        <p style={{ margin: "15px 0", color: "#3498db" }}>
          Creating torrent, please wait... This might take a while for large
          files.
        </p>
      )}
      {localError && (
        <p className="message error" style={{ marginBottom: "15px" }}>
          {localError}
        </p>
      )}

      <h3>Existing Torrents</h3>
      {torrents.length === 0 ? (
        <p>No torrents created yet.</p>
      ) : (
        <ul>
          {torrents.map((t) => (
            <li key={t.id} className="torrent-item">
              <p>
                <strong>Name:</strong> {t.name}
              </p>
              <p>
                <strong>Source:</strong> {formatTorrentSourcePath(t.sourcePath)}
              </p>
              <p>
                <strong>Private:</strong> {t.isPrivate ? "Yes" : "No"}
              </p>
              <p>
                <strong>Created:</strong>{" "}
                {new Date(t.createdAt).toLocaleString()}
              </p>
              <div className="actions-group" style={{ marginTop: "10px" }}>
                <button
                  onClick={() => handleDownloadTorrentFile(t.id)}
                  style={{ marginRight: "10px", marginBottom: "5px" }}
                >
                  Download .torrent
                </button>
                <button
                  onClick={() => handleDeleteTorrent(t.id)}
                  className="danger"
                  style={{ marginBottom: "5px" }}
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

export default TorrentsTab;
