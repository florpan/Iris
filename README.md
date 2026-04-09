# Iris

A minimal, self-hosted photo browser for your local photo collection. Point it at your image folders, and it indexes everything — metadata, GPS coordinates, camera info — then lets you browse, search, and explore your photos through a clean web UI.

## What it does

- **Automatic sync** — scans your source folders, extracts all EXIF/IPTC/GPS metadata, generates thumbnails
- **Folder browsing** — navigate your existing folder structure with a thumbnail grid
- **Search** — full-text search across filenames and metadata, plus structured filters (camera, lens, date range, format)
- **Map view** — see where your photos were taken on a Leaflet map with marker clustering
- **Timeline view** — browse photos chronologically, grouped by year/month/day
- **Faceted filtering** — drill down by camera model, lens, date, format, focal length
- **Detail view** — full metadata display with GPS mini-map, keyboard navigation
- **Light/dark mode**

Source folders are strictly read-only — Iris never writes to your photos. Thumbnails and all generated data go to a separate work folder.

## How it was built

This project was built in a single session as an end-to-end test of the [Waymark](https://github.com/florpan/waymark) spec-driven development system. The process:

1. Described the idea and requirements conversationally
2. Waymark generated 20 feature specs across 3 milestones
3. Flow analysis identified gaps and missing features
4. A build agent autonomously implemented all 20 features — all evaluations passed on the first attempt
5. A few minor fixes (CSS, Leaflet imports, thumbnail paths) and a Dockerfile were added manually

Total AI-generated code: ~9,500 lines across backend and frontend.

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, shadcn/ui, Leaflet
- **Backend:** Bun, Hono
- **Database:** PostgreSQL, Drizzle ORM
- **Image processing:** sharp (thumbnails), exifr (metadata extraction)

## Running with Docker

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgres://iris:iris@host:5432/iris \
  -e IRIS_SOURCES=photos:/data/photos \
  -e IRIS_WORK_FOLDER=/data/work \
  -v /path/to/your/photos:/data/photos:ro \
  -v /path/to/work:/data/work \
  registry.berge.tech/lab/iris:latest
```

Or use a `config.yaml` in the project root:

```yaml
sources:
  - name: photos
    path: /data/photos
  - name: camera
    path: /data/camera
workFolder: /data/work
```

## Running locally

```bash
# Prerequisites: Bun, PostgreSQL

# Create database
psql -U postgres -c "CREATE USER iris WITH PASSWORD 'iris'; CREATE DATABASE iris OWNER iris; GRANT ALL ON SCHEMA public TO iris;"

# Install dependencies
bun install
cd src/frontend && bun install && cd ../..

# Push schema to database
bunx drizzle-kit push

# Start dev servers (frontend on 5173, backend on 3002)
bun run dev
```

Configure source folders via `.env`:
```
DATABASE_URL=postgres://iris:iris@localhost:5432/iris
IRIS_SOURCES=photos:/path/to/your/photos
IRIS_WORK_FOLDER=./work
```

## Status

Working but rough around the edges. May or may not get improved upon.
