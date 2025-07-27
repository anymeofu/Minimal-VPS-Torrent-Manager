# Minimal VPS Torrent Manager 🚀

A lightweight web app for managing downloads and torrents on your VPS, with a cool retro dark theme. 📟

---

> ## ✨ What it Does
>
> | Features                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
> | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | 📥 **Download Manager**: Paste URLs to download files, with progress/speed tracking and auto-extraction of archives. <br> 🌱 **Torrent Creator**: Turn any file/folder into a `.torrent`, with support for webseeds and private trackers. <br> 🎬 **Media Info**: Automatically fetches IMDb details for your media. <br> 📂 **File Browser**: Navigate, manage, and delete files in your downloads directory. <br> 🔐 **Secure Access**: Protected by a username/password login. <br> 🌐 **Built-in File Server**: A dedicated public route lets you serve files directly, perfect for using as webseeds. |
>
> ---
>
> ## 🚀 Getting Started (for First-Time Users)
>
> | 🔧 Setup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
> | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | **1. Get the Code**: Clone the repository or download the files to your computer. <br> **2. Open Terminal**: Navigate into the project directory: `cd vps-torrent-manager`. <br> **3. Install Dependencies**: Run the following command. This will read the `package.json` file and automatically install everything the project needs to run, including `react`, `express`, and development tools like `concurrently`. <br> `bash <br> npm install <br> ` <br> **4. Configure Environment**: Copy the example environment file, then edit the new `.env` file with your desired username, password, and a unique session secret. <br> `bash <br> cp .env.example .env <br> ` |
>
> | 🏃 Run the App (in Development)                                                                                                                                                                                                                                                                                                                                                                                             |
> | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | To start the app for development, run this single command in your terminal: <br> `bash <br> npm run dev <br> ` <br> This uses `concurrently` to start both the backend server (`nodemon`) and the frontend builder (`esbuild`) in the same window. The application will be available at `http://localhost:3001` and will automatically reload in your browser when you save changes to either the frontend or backend code. |
>
> ---
>
> ## 📖 Usage Guide
>
> 1.  **Login**: Access the app's URL and log in.
> 2.  **Downloads Tab**: Add direct URLs to download files.
> 3.  **Torrents Tab**: Create new `.torrent` files from your downloaded content.
> 4.  **Files Tab**: Browse your `downloads/` directory, delete items, match media with IMDb, and more.
>
> ---
>
> ## 🤔 Troubleshooting
>
> - **`EADDRINUSE` Error**: The port is already in use. Stop the other process or change the port in `.env`.
> - **IMDb Lookups Fail**: Ensure your `OMDB_API_KEY` in `.env` is valid.
> - **RAR/TAR Extraction Fails**: Make sure `unrar` and `tar` are installed on your server and are in the system's PATH.
> - **SQLite Errors**: If you encounter database errors after an update, you may need to delete the `.sqlite` files in `src/db/` and restart the app. **This will erase all existing data.**
