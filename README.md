
# Running Locally & Development

The open-source repository contains the complete source code for both the **Web Dashboard UI** (`web/`) and the **Dashboard REST API Backend** (`cmd/dashboard`, `internal/api/`).

If you are a developer looking to contribute, customize the interface, or test changes, you can run **just the dashboard and its backend** locally from source without starting the streaming engines (`xtream`, `redirector`, `syncer`) or the Caddy ingress gateway.


---

## 1. System Requirements

Before running the project from source, ensure you have the following installed on your development machine:

- **Node.js**: `v24.0.0` or higher (with `npm`).
- **Go**: `1.22` or higher (if modifying or compiling the backend).
- **Git**: For version control.
- **Docker**: *(Optional, but recommended)* To run MariaDB with a single command.

---

## 2. Setting Up the Database

The Go backend requires a connection to a MariaDB database (Redis is optional for development).

If you have Docker installed, spin up a MariaDB container in seconds:

```bash
docker run -d --name mariadb -p 3306:3306 \
  -e MARIADB_ROOT_PASSWORD=root \
  -e MARIADB_DATABASE=playlistlabs \
  -e MARIADB_USER=playlistlabs \
  -e MARIADB_PASSWORD=playlistlabspass \
  mariadb:10.11
```

*(Alternatively, if working within the repository workspace, you can start only the database using: `docker compose up -d mariadb`)*

Next, create your local configuration by copying the example environment file in the project root:

```bash
cp .env.example .env
```

The default connection string in `.env.example` points directly to `127.0.0.1:3306` with user `playlistlabs` and password `playlistlabspass`.

---

## 3. Live Development Mode (No Compilation Needed)

This is the recommended workflow for day-to-day UI and API development. It provides instant feedback with Hot Module Replacement (HMR).

### Terminal 1: Start the Go Backend API
From the root of the repository:

```bash
go run ./cmd/dashboard
```

- Go compiles the code in memory on the fly without producing a binary on disk.
- On first startup, the backend automatically runs initial database migrations (`sql/001_init_schema.sql`) if the database is empty.
- The REST API service starts listening on **`http://localhost:8080`**.

### Terminal 2: Start the React Frontend Dev Server
In a second terminal window, navigate to the `web/` directory:

```bash
cd web
npm install
npm run dev
```

- Vite starts a local development server on **`http://localhost:5173`**.
- Any changes you save in `.jsx`, `.js`, or `.css` files reload immediately in your browser.
- The built-in proxy in `vite.config.js` transparently forwards all API requests (`/api/*`, `/player_api.php`, `/get.php`) from port `5173` to port `8080`.

Open **`http://localhost:5173`** in your browser to access the dashboard.

---

## 4. Compiling a Standalone Production Build

If you made modifications and wish to bundle the application into a single self-contained binary:

### 1. Compile the Frontend
```bash
cd web
npm install
npm run build
cd ..
```
This produces minified, optimized HTML, JS, and CSS files inside `web/dist/`.

### 2. Compile the Go Backend Binary
```bash
go build -ldflags="-s -w" -o bin/dashboard ./cmd/dashboard
```
This generates a fast, statically linked binary (`bin/dashboard` on Linux/macOS or `bin/dashboard.exe` on Windows).

### 3. Run the Compiled Dashboard
Run the binary, instructing it where to find the compiled frontend assets:

```bash
STATIC_DIR=web/dist ./bin/dashboard
```

*(On Windows PowerShell: `$env:STATIC_DIR="web/dist"; .\bin\dashboard.exe`)*

Open **`http://localhost:8080`** in your browser. The single Go binary now serves both the React production frontend and all REST endpoints simultaneously.

---

## 4. Building a Custom Docker Image

If you want to package your custom code into a Docker image identical to the official releases:

```bash
docker build -f deploy/Dockerfile.dashboard -t custom-user-management-dashboard .
```

The multi-stage `deploy/Dockerfile.dashboard` automatically:
1. Installs Node.js dependencies and builds the React SPA.
2. Compiles the Go backend binary using native Go cross-compilation.
3. Copies only the binary and the static assets into a minimal Alpine Linux image.
