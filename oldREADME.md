# Minimal VPS Torrent Manager

A lightweight web application for managing downloads and torrents on a VPS, designed with a minimalist retro dark theme.

## Features

*   **Download Management**:
    *   Submit URLs (direct links to files or archives) for download to the VPS.
    *   Automatic extraction of archives (`.zip`, `.rar`, `.tar.gz`, `.tar`) upon download completion.
        *   `.zip` is handled by an internal library.
        *   `.rar`, `.tar.gz`, `.tar` require `unrar` and `tar` system commands to be installed on the VPS.
    *   Display of download progress (bytes, percentage) and speed.
    *   List current and past downloads with status.
    *   Manual deletion of downloads and their associated files.
    *   **Torrent Creation**:
    *   Create `.torrent` files from downloaded files or folders.
        *   The name of the file (for single-file torrents) or the root folder (for directory torrents) *inside* the `.torrent` metadata will accurately reflect the original name on disk.
        *   The "Torrent Name" field in the UI (which can be pre-filled from the Files tab using the exact source name) serves as a display label within the app, for the `.torrent` filename, and in the torrent's comment.
    *   Option to add custom webseed URLs.
    *   Suggests a webseed URL pointing to the file served by this application itself (`http(s)://<your_domain_or_ip>:<port>/serve_file/...`) if the source is a single file.
    *   Support for private torrents.
    *   Option to specify custom tracker/announce URLs (defaults are provided).
    *   Download generated `.torrent` files.
    *   List and delete created torrents.
*   **Media Information**:
    *   Attempt to match filenames/foldernames with IMDB data.
    *   Display basic metadata: title, year, poster image, plot, rating, genres.
    *   (Note: Requires an OMDB API key for reliable results).
*   **File Management**:
    *   Browse files and folders within the main `downloads/` directory.
    *   Navigate into subfolders and back to parent directories.
    *   Manual deletion of any file or folder from the `downloads/` directory.
    *   Display basic storage usage information for the downloads directory's filesystem.
*   **User Interface**:
    *   Minimalist retro dark theme (black background with blue and green accents).
    *   Tab-based navigation: Downloads, Torrents, Files.
    *   Frontend JavaScript bundle is minified for faster loading.
*   **Authentication**:
    *   Secure access with username/password authentication.
    *   Persistent sessions: "Keep me logged in" option works across server restarts.
    *   Configuration via `.env` file for credentials, session secret, and API keys.
*   **File Serving**:
    *   Publicly accessible route (`/serve_file/<path_to_file_in_downloads>`) for serving downloaded files, primarily intended for use as webseeds.

## Setup and Installation

### Prerequisites
*   Node.js (v12.22.9 or a compatible version, check your environment)
*   npm (Node Package Manager)
*   A VPS or server environment where you can run Node.js applications.
*   **System commands for full archive support**:
    *   `unrar` (for `.rar` extraction)
    *   `tar` (for `.tar.gz` and `.tar` extraction)
    These need to be installed on your VPS and accessible in the system PATH.

### Installation Steps
1.  **Clone or Download**:
    If this project were in a Git repository:
    ```bash
    git clone <repository_url>
    cd vps-torrent-manager
    ```
    Otherwise, ensure all project files are in a directory named `vps-torrent-manager`.

2.  **Install Dependencies**:
    Navigate to the project root directory (`vps-torrent-manager`) and run:
    ```bash
    npm install
    ```
    This will install all necessary packages listed in `package.json`.

3.  **Configure Environment Variables**:
    a.  Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    b.  Edit the newly created `.env` file with your preferred settings:
        *   `ADMIN_USERNAME`: Your desired username for logging into the app.
        *   `ADMIN_PASSWORD`: Your desired password.
        *   `SESSION_SECRET`: **Crucial for security.** Change this to a long, random, and unique string. You can generate one using a password generator or by running this in your terminal:
            ```bash
            node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
            ```
        *   `OMDB_API_KEY` (Optional but Recommended): If you want reliable IMDB lookups for media files, get a free API key from [OMDb API](https://www.omdbapi.com/apikey.aspx) and paste it here.
        *   `PORT` (Optional): Defaults to `3001` if not set. You can change the port the application runs on.

4.  **Directory Permissions (Important for VPS)**:
    Ensure the Node.js process has write permissions for the following directories (which will be created automatically if they don't exist, but permissions might be an issue):
    *   `vps-torrent-manager/src/db/` (for `database.sqlite` and `sessions.sqlite`)
    *   `vps-torrent-manager/downloads/` (for downloaded files)
    *   `vps-torrent-manager/torrents/` (for generated .torrent files)

## Running the Application

### For Development
From the project root directory:
```bash
npm run dev
```
This command will:
1.  Build the minified frontend JavaScript bundle (`public/bundle.js`).
2.  Start the Node.js server using `nodemon`, which automatically restarts the server when backend files change.
The application will typically be accessible at `http://localhost:3001` (or the port you configured).

### For Production on a VPS
1.  **Set Environment Variables**: Ensure all variables from your `.env` file (or their equivalents) are set in your production environment. Crucially, set `NODE_ENV=production`.
2.  **Build Frontend (if not part of deploy script)**:
    ```bash
    npm run build:frontend
    ```
3.  **Start with a Process Manager (Recommended)**: Use a process manager like PM2 to keep the application running robustly.
    *   Install PM2 globally if you haven't: `sudo npm install pm2 -g`
    *   Start the application using the `npm start` script:
        ```bash
        pm2 start npm --name "vps-torrent-manager" -- run start
        ```
    *   To make PM2 restart on server reboot: `pm2 startup` (follow instructions) and `pm2 save`.
4.  **Reverse Proxy (Recommended for HTTPS)**:
    *   Set up a web server like Nginx or Apache as a reverse proxy.
    *   Configure it to listen on port 80 (HTTP) and 443 (HTTPS).
    *   Obtain an SSL/TLS certificate (e.g., using Let's Encrypt / Certbot).
    *   Proxy HTTPS requests to your Node.js application's local port (e.g., `http://localhost:3001`).
    *   Example Nginx snippet (simplified):
        ```nginx
        server {
            listen 80;
            server_name yourdomain.com;
            return 301 https://$host$request_uri; # Redirect HTTP to HTTPS
        }

        server {
            listen 443 ssl http2;
            server_name yourdomain.com;

            ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
            ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
            # ... other SSL settings ...

            location / {
                proxy_pass http://localhost:3001; # Or your app's port
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
            }
        }
        ```

## Usage Guide

1.  **Login**: Access the application URL in your browser. You'll be prompted to log in with the credentials you set in the `.env` file. Check "Keep me logged in" for longer sessions.
2.  **Downloads Tab**:
    *   **Add Download**: Enter a direct URL to a file or ZIP archive and click "Add Download".
    *   **View Progress**: Downloads in progress will show downloaded bytes, total bytes (if known), percentage, and current speed.
    *   **Actions**: Delete downloads (this also deletes the downloaded files).
3.  **Torrents Tab**:
    *   **Create Torrent**:
        *   **Source Path**: Enter the path to the file or folder within your `downloads/` directory (e.g., `myMovie.mp4` or `downloaded_folder`). Use the "Use for New Torrent" button on the Files tab to pre-fill this.
        *   **Torrent Name**: A display name for the torrent in the app. This is pre-filled with the exact source name if "Use for New Torrent" is used. This name is also used for the `.torrent` filename you download. The actual name of the content *inside* the torrent will match the source file/folder name on disk.
        *   **Webseeds**: Optionally, add comma-separated URLs for webseeds. If the source path is a single file, click "Suggest Self as Webseed" to add a URL pointing to that file served by this app.
        *   **Trackers**: Optionally, add comma-separated tracker URLs. If left empty, default public trackers are used.
        *   **Private Torrent**: Check if this is a private torrent.
    *   **Existing Torrents**: View a list of created torrents. You can download the `.torrent` file or delete the torrent record and its file.
4.  **Files Tab**:
    *   **Storage Info**: Displays basic disk space usage for the downloads directory filesystem.
    *   **Browse Files**: Lists files and folders in your `downloads/` directory. Click on folders to navigate into them, and ".." to go to the parent directory.
    *   **Actions**:
        *   **Delete**: Permanently delete a file or folder.
        *   **Match IMDB Info**: For any file or folder, click this to attempt to fetch metadata from IMDB. Results (title, year, poster, etc.) will be displayed below the item.
        *   **Use for New Torrent**: Click this to pre-fill the "Source Path" and "Torrent Name" on the "Torrents" tab, making it easier to create a torrent for that item.
        *   **Unarchive**: For supported archive files (`.zip`, `.rar`, `.tar.gz`, `.tar`), this button allows manual extraction into a subfolder within `downloads/`.

## Troubleshooting

*   **`EADDRINUSE` Error on Startup**: This means the port (e.g., 3001) is already in use.
    *   Find and stop the existing process:
        ```bash
        sudo lsof -i :<PORT_NUMBER> # Find PID
        sudo kill <PID>
        # Or, more directly:
        sudo fuser -k <PORT_NUMBER>/tcp
        ```
    *   Ensure you don't have multiple instances of the app trying to run.
*   **IMDB Lookups Fail or Are Unreliable**:
    *   Ensure you have a valid `OMDB_API_KEY` in your `.env` file.
    *   The OMDb free tier has daily limits.
*   **Download Progress Not Showing / "File: N/A"**:
    *   The remote server for the download URL might not provide a `Content-Length` header, making it impossible to show total size or percentage. Only downloaded bytes will be shown.
    *   "File: N/A" might appear briefly if the download hasn't started writing the file yet or if there was an early error. Check server logs.
*   **Frontend UI Not Updating After Code Changes (when using `npm start`)**:
    *   The `npm start` script does not automatically rebuild the frontend. Use `npm run dev` during development, as it rebuilds the frontend on changes. If you use `npm start` and make frontend code changes, you need to manually run `npm run build:frontend` before `npm start`.
*   **SQLite Errors (e.g., "no such column")**:
    *   If you've pulled updates that change the database schema, the existing `src/db/database.sqlite` file might be outdated. For development, the easiest fix is often to stop the app, delete `src/db/database.sqlite`, and restart the app. **This will delete all existing data.** For production, you would need to implement database migration scripts.
*   **RAR/TAR Extraction Fails**:
    *   Ensure `unrar` and `tar` command-line utilities are installed on your VPS and are in the system's PATH. The application relies on these for handling `.rar`, `.tar.gz`, and `.tar` files.
    *   Check server logs for specific errors from these commands.

---
Enjoy your Minimal VPS Torrent Manager!
