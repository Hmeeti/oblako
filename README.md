# OBLAKO — Automated Restaurant Menu

Full-stack menu for **OBLAKO Lounge Bar**: public site, hidden admin panel, SQLite database, and an automated image-matching pipeline for dish photos.

## Stack

| Layer | Technology |
|---|---|
| Server | Node.js 18+, Express |
| Database | SQLite via built-in `node:sqlite` (Node 22+) |
| Auth | bcrypt + express-session, rate-limited login |
| Images | HEIC→JPEG (`heic-convert`), optimize (`sharp`) |
| Vision matching | OpenAI GPT-4o-mini Vision (optional) + heuristic fallback |
| Public UI | Existing OBLAKO static frontend + `/api/menu` |
| Admin UI | SPA at obscure URL (not linked publicly) |

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. First-time setup (creates .env, seeds menu from js/data.js)
npm run setup

# 3. Start the server
npm start
```

- **Public menu:** http://localhost:3000  
- **Admin panel:** http://localhost:3000/ctl/x7k9m2p4w4oblako (change `ADMIN_PATH` in `.env`)

On first setup, a **temporary admin password** is printed to the terminal. Change it immediately:

```bash
npm run hash-password -- "your-new-secure-password"
# Copy the hash into .env → ADMIN_PASSWORD_HASH=
```

## Environment variables

Copy `.env.example` → `.env`:

| Variable | Description |
|---|---|
| `PORT` | Server port (default `3000`) |
| `SESSION_SECRET` | Random string for session cookies |
| `ADMIN_PATH` | Obscure admin URL path (e.g. `ctl/x7k9m2p4w4oblako`) |
| `ADMIN_USERNAME` | Admin login (default `hmeeti`) |
| `ADMIN_PASSWORD_HASH` | bcrypt hash — **never store plaintext password** |
| `OPENAI_API_KEY` | Optional — enables accurate AI photo matching |
| `DATABASE_PATH` | SQLite file path (default `data/oblako.db`) |

## Automated image pipeline

Place dish photos in the `image/` folder (JPEG, PNG, HEIC supported). Logo/favicon are ignored.

```bash
npm run match-images
```

### What the pipeline does

1. **Scans** `image/` for dish photos  
2. **Converts** HEIC → optimized JPEG in `public/image/optimized/`  
3. **Analyzes** each photo:
   - With `OPENAI_API_KEY`: GPT-4o Vision identifies the dish and picks the best menu item  
   - Without API key: keyword/heuristic matching against names & descriptions  
   - Optional DuckDuckGo hint lookup for ambiguous cases  
4. **Assigns** the best photo to each menu item in the database  
5. **Logs** every match in `image_matches` (viewable in admin → «Фото-матчи»)

### Re-run when new photos arrive

Add files to `image/` and run again:

```bash
npm run match-images
```

Already-assigned items are preserved; new photos fill empty slots or improve matches (delete `public/image/optimized/` to force full re-conversion).

## Admin panel

Access only via the secret URL from `ADMIN_PATH`. Not linked on the public site, blocked in `robots.txt`, decoy 404 on `/admin`.

Features:
- Dashboard (stats, recent activity)
- CRUD for dishes & categories
- Manual photo upload / reassignment
- Filterable activity log (logins, edits, image changes)
- Basic analytics (page views, popular categories)
- Easter eggs: floating cloud loader, confetti on save, witty empty states

## Public site

- Loads menu dynamically from `GET /api/menu`
- Categories, subcategories, dual prices, volumes
- Dish photos when assigned by pipeline or admin
- Responsive grid/list views
- Search across names & descriptions

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Run production server |
| `npm run dev` | Run with auto-reload |
| `npm run setup` | Create `.env`, seed database |
| `npm run seed` | Import menu from `js/data.js` |
| `npm run match-images` | Run photo matching pipeline |
| `npm run hash-password -- "pass"` | Generate bcrypt hash |

## Security notes

- Password is stored as **bcrypt hash** only — never commit `.env`
- Admin path is configurable and non-obvious
- Login rate-limited (10 attempts / 15 min)
- Sessions expire after 2 hours
- Admin routes return 401 without valid session
- `/admin` and similar paths show a decoy 404

## Project structure

```
oblako/
├── server/           # Express app, routes, DB
├── scripts/          # setup, seed, hash-password
├── pipeline/         # image convert, vision, matcher
├── admin-panel/      # hidden admin SPA
├── js/data.js        # seed data source (157 items)
├── image/            # source dish photos (HEIC/JPEG)
├── public/image/     # optimized & uploaded images
└── data/oblako.db    # SQLite database (created on setup)
```

## Updating menu data

1. Edit items in the **admin panel**, or  
2. Edit `js/data.js`, delete `data/oblako.db`, run `npm run seed`

---

© 2026 OBLAKO — developed by **hmeeti**
