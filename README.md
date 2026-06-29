# note-viewer

Personal Obsidian vault viewer with a VitePress-style dark UI. Built with React + Express.

## Setup

```bash
cp .env.example .env
# Edit .env and set your VAULT_PATH
```

## Run with Docker (recommended)

```bash
docker compose up --build -d
```

Open http://localhost:3001

## Run in dev mode

```bash
npm install
npm run dev
```

- Express: http://localhost:3001
- Vite: http://localhost:5173

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/notes | List all notes (with frontmatter) |
| GET | /api/note?path= | Get single note content |
| GET | /api/search?q= | Full-text search (max 30 results) |
| POST | /api/note/create | Create note `{ folder, title, tags }` |
| PUT | /api/note/save | Save content (preserves frontmatter) |
| PUT | /api/note/rename | Rename note (syncs MD + HTML + PDFs + frontmatter) |
| PUT | /api/note/move | Move note to another folder |
| PUT | /api/note/tags | Update tags only |
| DELETE | /api/note?path= | Delete note |
| GET | /api/pins | Get pinned notes |
| POST | /api/pins/toggle | Toggle pin `{ path }` |
| GET | /api/categories | Get dynamic category metadata |
| POST | /api/folder/create | Create folder with icon `{ folder, icon, desc }` |
| POST | /api/note/export-html | Export note to `_html/` |
| GET | /api/note/has-html | Check if note has HTML version |
