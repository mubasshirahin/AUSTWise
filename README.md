# AUSTWise

All-in-one utility tool for students of **Ahsanullah University of Science & Technology (AUST)** — routines, course reviews, campus maps, bus tracking, library occupancy, vault/notes, messaging, and more.

## Stack

- **Frontend:** React 19 + Vite 8 (rolldown), PWA (vite-plugin-pwa)
- **Backend:** Node.js (zero-framework HTTP server in `server/dev.mjs`), bcrypt + JWT auth
- **Database:** SQL Server (via `mssql` / Prisma adapter), with JSON-file fallback
- **Storage:** Local JSON files for runtime data (users, messages, password vault, …)

## Development

```bash
npm install
cp .env.example .env   # then fill in your values
npm run dev            # Vite HMR + API server on http://localhost:5174
```

## Production

### 1. Configure `.env`

Copy `.env.example` to `.env` and set at minimum:

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Sign auth tokens. `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ADMIN_DEFAULT_PASSWORD` | Seeds the first admin account on first run. **Change after first login.** |
| `CRYPTO_SECRET_KEY` | Password-vault AES-256-GCM key. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DB_SERVER` / `DB_DATABASE` / `DB_USER` / `DB_PASSWORD` | SQL Server connection (host + static port, e.g. `localhost:1433`) |
| `COOKIE_SECURE=1` | Marks the auth cookie `Secure` (required behind HTTPS) |
| `ALLOWED_ORIGIN` | Comma-separated CORS origins; empty = same-origin only (recommended) |

Runtime data files (`server/users.json`, `messages.json`, `password_vault.json`, …) are gitignored and created fresh on first boot.

### 2. Build & run

```bash
npm run build          # bundles the SPA into dist/
npm start              # node server/dev.mjs — auto-pins NODE_ENV=production
```

The server serves the built SPA and the API on `PORT` (default 5174). In production mode the dev-only endpoints (`/api/dev/*`, `/__dev/users`) are hard-disabled.

### 3. HTTPS (required in production)

The server speaks plain HTTP — terminate TLS with a reverse proxy (nginx / Caddy / PM2 + certbot). Example nginx:

```nginx
server {
    listen 443 ssl;
    server_name austwise.example.com;

    ssl_certificate     /etc/letsencrypt/live/austwise.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/austwise.example.com/privkey.pem;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:5174;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (real-time messaging)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Then set `COOKIE_SECURE=1`, optionally `ENABLE_HSTS=1`, and restart.

### 4. Process manager (PM2)

```bash
npm i -g pm2
pm2 start server/dev.mjs --name austwise --env production
pm2 save && pm2 startup
```

### Security notes

- Passwords are bcrypt-hashed; password-vault entries are AES-256-GCM encrypted.
- Auth uses an `HttpOnly` + `SameSite=Lax` cookie (adds `Secure` with `COOKIE_SECURE=1`).
- Rate limiting is built in (global flood guard + stricter auth/extract limits).
- SQL queries are parameterized. CORS is same-origin unless `ALLOWED_ORIGIN` is set.
- Dev-only endpoints are disabled in `NODE_ENV=production`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint over `src/`, `server/`, `scripts/` |
| `node scripts/seed-sqlserver.mjs` | One-time seed of courses/locations into SQL Server (idempotent) |  


![Alt](https://repobeats.axiom.co/api/embed/aa1520a9d2b4266306be390e45695fd787d58562.svg "Repobeats analytics image")