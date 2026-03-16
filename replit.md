# FluxDown — Universal Downloader

## Overview
A universal link downloader web app that lets users download YouTube videos, direct file links, images, audio, and more. Features a global recent-downloads feed and per-user download history.

## Architecture
- **Frontend**: React + TypeScript + Vite (port 5000)
- **Backend**: Node.js + Express (same port, /api routes)
- **Database**: JSON file at `data/db.json` (no PostgreSQL by design)
- **Styling**: Tailwind CSS + shadcn/ui + framer-motion

## Key Features
- User registration by name + auto-detected IP + localStorage deviceId
- URL analysis: YouTube metadata (ytdl-core) + direct file HTTP HEAD
- Proxied file downloads for both YouTube and direct URLs
- Global recent downloads feed (polls every 8 seconds)
- Per-user download history
- Dark / light mode toggle (persists to localStorage)

## Project Structure
```
client/src/
  App.tsx            - Root with ThemeContext + QueryClientProvider
  pages/Home.tsx     - Main page with all UI components
  index.css          - Blue/cyan theme (electric blue primary, cyan accent)

server/
  index.ts           - Express server entry point
  routes.ts          - All API routes (/api/users, /api/analyze, /api/downloads)
  storage.ts         - JsonStorage class reading/writing data/db.json

shared/
  schema.ts          - TypeScript types: User, Download, UrlInfo

data/
  db.json            - JSON file database (users + downloads arrays)
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/users/register | Create or retrieve user by deviceId |
| GET | /api/users/:id | Get user info |
| POST | /api/analyze | Analyze URL — returns metadata, thumbnail, formats |
| POST | /api/downloads | Record a download |
| GET | /api/download/:id/file | Stream/proxy the actual file |
| GET | /api/downloads/recent | Last 20 completed downloads (global) |
| GET | /api/downloads/user/:userId | User's download history |

## Color Theme
- Primary: Electric blue `hsl(217 91% 55%)` (light) / `hsl(217 91% 60%)` (dark)
- Accent: Cyan `hsl(199 89% 48%)` (light) / `hsl(199 89% 52%)` (dark)
- Background (dark): Deep navy `hsl(222 39% 8%)`

## Dependencies Added
- `ytdl-core` — YouTube video info and streaming
- `axios` — HTTP proxy for direct file downloads

## User Flow
1. First visit → WelcomeModal asks for name → stored in localStorage
2. Paste URL → click Analyze → server returns metadata
3. AnalysisCard shows: thumbnail, title, format picker (YouTube), download button
4. Click Download → file streamed via /api/download/:id/file
5. Global feed and user history update automatically
