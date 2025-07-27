> ## 🚀 Minimal VPS Torrent Manager
>
> _A lightweight web app for managing downloads and torrents on your VPS, with a cool retro dark theme. 📟_
>
> ---
>
> | ✨ Features                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
> | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | 📥 **Download Manager**: Paste URLs to download files, with progress/speed tracking and auto-extraction of archives. <br> 🌱 **Torrent Creator**: Turn any file/folder into a `.torrent`, with support for webseeds and private trackers. <br> 🎬 **Media Info**: Automatically fetches IMDb details for your media. <br> 📂 **File Browser**: Navigate, manage, and delete files in your downloads directory. <br> 🔐 **Secure Access**: Protected by a username/password login. <br> 🌐 **Built-in File Server**: A dedicated public route lets you serve files directly, perfect for using as webseeds. |
>
> | 🔧 Setup and Installation                                                                                                                                                                                                                                                                                                                |
> | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | **1. Prerequisites**: You'll need Node.js, npm, a VPS, and optionally `unrar` and `tar` for full archive support. <br> **2. Install Dependencies**: Run `npm install` in the project directory. <br> **3. Configure**: Copy `.env.example` to `.env` and fill in your `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a unique `SESSION_SECRET`. |
>
> | 🏃 Running the Application                                                                                                                                                                                                          |
> | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | **For Development**: Run `npm run dev` to start the server with auto-restarts. <br> **For Production**: Use a process manager like PM2 (`pm2 start npm -- run start`) and set up a reverse proxy like Nginx for security and HTTPS. |
>
> ---
>
> ### 📖 Usage Guide
>
> 1.  **Login**: Access the app's URL and log in.
> 2.  **Downloads Tab**: Add direct URLs to download files.
> 3.  **Torrents Tab**: Create new `.torrent` files from your downloaded content.
> 4.  **Files Tab**: Browse your `downloads/` directory, delete items, match media with IMDb, and more.
>
> ---
>
> ### 🤔 Troubleshooting
>
> - **`EADDRINUSE` Error**: The port is already in use. Stop the other process or change the port in `.env`.
> - **IMDb Lookups Fail**: Ensure your `OMDB_API_KEY` in `.env` is valid.
> - **UI Not Updating**: If using `npm start`, you must manually run `npm run build:frontend` to see UI changes. Use `npm run dev` instead.
> - **RAR/TAR Extraction Fails**: Make sure `unrar` and `tar` are installed on your server.
