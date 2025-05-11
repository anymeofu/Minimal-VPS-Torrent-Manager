# README_AI: Development Process for VPS Torrent Manager

This document outlines the iterative development process undertaken by the AI (Cline) to create the Minimal VPS Torrent Manager web application.

## 1. Initial Setup & Scaffolding
-   **Project Initialization**: Created the project directory `vps-torrent-manager` and initialized a Node.js project using `npm init -y`.
-   **Dependency Installation**:
    -   Backend: `express`, `sqlite3`, `axios`. `torrent-creator` was initially chosen but later replaced with `create-torrent` due to an npm registry issue. `extract-zip` and `unrar.js` (though unrar functionality is not fully implemented yet) were added for archive handling.
    -   Frontend: `react`, `react-dom`.
    -   Dev: `esbuild` (for frontend bundling), `nodemon` (for server auto-restart during development).
-   **Directory Structure**: Established a basic structure: `public/` (for static assets, bundled JS), `src/` (backend source), `src/db/` (SQLite database files), `src/routes/` (API route modules), `src/frontend/` (React source files).
-   **Core Server (`src/index.js`)**: Set up a basic Express server, middleware for JSON parsing and static file serving (`public/`).
-   **Database Setup (`src/index.js`)**: Initialized an SQLite database (`database.sqlite`) and defined schemas for `downloads`, `torrents`, and `media_files` tables. This involved an early bug fix for `SQLITE_CANTOPEN` by ensuring the `src/db` directory was created before DB initialization.
-   **Basic Frontend Shell**:
    -   `public/index.html`: Basic HTML structure with a root div for React and links to `style.css` and `bundle.js`.
    -   `public/style.css`: Implemented the requested retro dark theme with blue/green accents and monospace fonts.
    -   `src/frontend/App.js`: Main React component with tab-based navigation structure (Downloads, Torrents, Files).
    -   `src/frontend/index.js`: React DOM rendering entry point.
-   **Build Scripts (`package.json`)**: Added `start`, `build:frontend` (using `esbuild`), and `dev` scripts. Encountered issues with `package.json` creation/updates initially, requiring a direct `write_to_file` to establish it.

## 2. Core Feature Implementation (Iterative)

### A. Download Management
-   **Backend (`src/routes/downloads.js`)**:
    -   Created API endpoints: `POST /api/downloads` (submit URL), `GET /api/downloads` (list), `DELETE /api/downloads/:id` (delete).
    -   Implemented asynchronous file download using `axios` streams.
    -   Handled filename extraction from `Content-Disposition` or URL.
    -   Integrated `extract-zip` for automatic ZIP archive extraction upon download completion.
    -   Managed download status updates in the database.
-   **Frontend (`src/frontend/DownloadsTab.js`)**:
    -   Form for submitting URLs.
    -   Display list of downloads with status, file path, etc.
    -   Polling mechanism (`setInterval`) to refresh download list.
    -   Delete functionality.
-   **Download Progress & Speed (Later Enhancement)**:
    -   Updated `downloads` table schema to include `totalBytes` and `downloadedBytes`. This required guiding the user to delete their old `database.sqlite` to apply the schema change, as `CREATE TABLE IF NOT EXISTS` doesn't alter existing tables.
    -   Modified `src/routes/downloads.js` to:
        -   Store `Content-Length` as `totalBytes`.
        -   Track `downloadedBytes` in an in-memory store (`downloadProgressStore`) during active downloads.
        -   Augment `GET /api/downloads` responses with live progress data.
    -   Updated `src/frontend/DownloadsTab.js` to:
        -   Display progress (bytes, percentage).
        -   Calculate and display download speed based on polled data.
        -   Increased polling frequency for smoother speed updates.

### B. Torrent Creation
-   **Backend (`src/routes/torrents.js`)**:
    -   Created API endpoints: `POST /api/torrents` (create), `GET /api/torrents` (list), `GET /api/torrents/:id/file` (download .torrent), `DELETE /api/torrents/:id` (delete).
    -   Used `create-torrent` library to generate .torrent files.
    -   Handled parameters: source path (validated to be within `downloads/`), torrent name, webseeds, private flag, custom announce list (with defaults).
    -   Saved generated .torrent files to a `torrents/` directory.
    -   Stored torrent metadata in the database.
-   **Frontend (`src/frontend/TorrentsTab.js`)**:
    -   Form for creating torrents with all necessary inputs.
    -   List of existing torrents with download and delete options.
    -   Polling for list updates.
-   **Usability Enhancements (User Feedback)**:
    -   "Use for New Torrent" button in `FilesTab.js` to pre-fill `sourcePath` in `TorrentsTab.js` (using `sessionStorage`).
    -   Auto-suggestion for "Torrent Name" based on the selected source file/folder name (cleaned up, extension removed).
    -   "Suggest Self as Webseed" button:
        -   Created a public file serving route (`/serve_file/:filePath(*)`) in `src/routes/publicFilesRouter.js` (mounted before auth middleware in `index.js`).
        -   `TorrentsTab.js` generates a webseed URL using `window.location.origin` and this route, appending it to the webseed input.

### C. Media Information & File Management
-   **Backend (`src/routes/media.js`, `src/routes/files.js`)**:
    -   Installed `imdb-api` package.
    -   `GET /api/media/match/:filename`: Endpoint to search IMDB using `imdb-api`. Handles basic filename parsing (remove extension, year extraction). Includes a note about needing an `OMDB_API_KEY` (via `.env`) for reliability.
    -   `GET /api/files/space`: Implemented using `df -h` (via `child_process.exec`) to get disk space info.
    -   `GET /api/files/download_contents`: Lists files/folders in the `downloads/` directory. Enhanced to support `?path=` query for navigating subdirectories and added ".." parent links.
    -   `POST /api/files/delete`: Deletes files/folders from `downloads/`. Attempts to clean up related `media_files` DB entries. Addressed an `fs.rm is not a function` error by changing to `fs.rmdir` for Node.js v12 compatibility.
-   **Frontend (`src/frontend/FilesTab.js`)**:
    -   Displays storage space.
    -   Lists files/folders with navigation into subdirectories.
    -   "Delete" button for each item.
    -   "Match IMDB Info" button for files and folders (as per user request).
    -   Displays fetched IMDB info (poster, title, year, plot, etc.).

## 3. Authentication & Security
-   **Dependencies**: Added `express-session`, `cookie-parser`.
-   **Session Management (`src/index.js`)**:
    -   Configured `cookieParser` and `express-session`.
    -   Implemented persistent sessions using `connect-sqlite3` to store session data in `src/db/sessions.sqlite`, ensuring "Keep me logged in" works across server restarts. This was a fix for sessions being lost when `nodemon` restarted the server.
-   **Authentication Logic (`src/routes/auth.js`)**:
    -   Created `POST /api/auth/login`, `GET /api/auth/status`, `POST /api/auth/logout` endpoints.
    -   Used simple hardcoded admin credentials (with clear warnings and instructions to change via `.env`).
    -   Implemented "Keep me logged in" by extending session cookie `maxAge` if requested.
-   **Route Protection (`src/index.js`)**: Added middleware to protect all `/api/*` routes (except `/api/auth/*`) ensuring they require authentication.
-   **Frontend Auth Handling (`src/frontend/App.js`, `src/frontend/LoginForm.js`)**:
    -   `LoginForm.js` component created.
    -   `App.js` checks auth status on load. Renders `LoginForm` or main app content based on auth state.
    -   Displays current user and logout button.
-   **.env Configuration**:
    -   Installed `dotenv` package.
    -   Added `require('dotenv').config()` at the top of `src/index.js`.
    -   Created `.env.example` for `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `OMDB_API_KEY`.
    -   Added `.env` and other generated files/folders (`node_modules`, `downloads/`, `torrents/`, database files) to `.gitignore`.
    -   Updated `.env.example` with better instructions for generating a strong `SESSION_SECRET`.
-   **Rate Limiting (Initially Added, Then Removed)**:
    -   Installed `express-rate-limit`.
    -   Configured in `src/index.js`.
    -   Encountered Node.js version incompatibility (`express-rate-limit` v7 needs Node 16+, user has v12). Downgraded to v6 and adjusted options.
    -   Later removed entirely as per user request.

## 4. Optimization & Refinements
-   **Frontend Build (`package.json`)**: Added `--minify` flag to `esbuild` command in `build:frontend` script, significantly reducing `bundle.js` size.
-   **Code Structure**: Refactored API routes to accept `db` instance via function parameters instead of `require('../index')` to resolve circular dependency issues with `db` initialization.
-   **Error Handling & Bug Fixes**:
    -   Addressed `EADDRINUSE` errors by guiding user to kill old processes and eventually changing the default port from 3000 to 3001.
    -   Fixed `SQLITE_ERROR: table downloads has no column named totalBytes` by instructing user to delete old DB file so new schema could apply.
    -   Corrected `fs.rm` to `fs.rmdir` for Node v12 compatibility.
    -   Fixed `path.sep` usage in frontend `formatPath` to use `/`.
    -   Handled several `replace_in_file` tool errors due to stale file content or incorrect SEARCH blocks, often resorting to `write_to_file` for critical restorations.

## 5. User-Requested Removals
-   **Rate Limiting**: Fully removed from code and dependencies.
-   **Auto-delete Timers for Downloads**: Removed UI, API endpoint, background job, and related DB schema fields from `downloads` table.

## 6. Further Archive Handling Enhancements (User Feedback)
-   **Expanded Archive Support**:
    -   Modified `src/routes/downloads.js` (`attemptExtraction`) and `src/routes/files.js` (`POST /api/files/unarchive`) to handle `.rar` and `.tar.gz` files using system commands (`unrar x` and `tar -xzf` respectively via `child_process.execAsync`).
    -   Further extended support to plain `.tar` files (using `tar -xf`).
    -   Updated `src/frontend/FilesTab.js` to show the "Unarchive" button for these additional archive types (`.rar`, `.tar.gz`, `.tar`).
-   **Torrent Naming Correction**:
    -   Addressed user feedback that the name of the file *inside* a single-file torrent was incorrect (e.g., missing extension).
    -   Modified `src/routes/torrents.js` (`POST /api/torrents`):
        -   It now checks if the source path is a file or directory.
        -   If a file, `opts.name` for `create-torrent` is set to the actual `basename` of the source file (preserving its extension).
        -   If a directory, `opts.name` uses the user-provided "Torrent Name" from the form as the root folder name within the torrent.
    -   The "Torrent Name" field in the UI (from `TorrentsTab.js`) still allows users to set a display/friendly name for the torrent, which is stored in the DB and used for the `.torrent` filename, while the internal metadata name is now more accurate for single files.
-   **Torrent Creation Loading State**:
    -   Added `isCreatingTorrent` state to `src/frontend/TorrentsTab.js`.
    -   The "Create Torrent" button now shows "Creating..." and is disabled during the process.
    -   A message "Creating torrent, please wait..." is displayed to improve UX for potentially long operations.


This iterative process, driven by the initial prompt and continuous user feedback, led to the current state of the application.
