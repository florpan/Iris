# Project State

## System Overview
Iris is a single-user image management system that scans source folders for images, extracts comprehensive metadata, and provides a web interface for browsing and managing photo collections. It serves as a centralized hub for organizing large photo libraries with support for both common formats and camera RAW files.

## Tech Stack
- Runtime: Bun
- Framework: Hono (backend), React 19 + Vite (frontend)
- Database: PostgreSQL with Drizzle ORM
- Frontend: Tailwind CSS + shadcn/ui components
- Infrastructure: Docker Compose for development

## User Roles
- Single User — can configure source folders, trigger image scans, browse metadata, and manage the photo collection through the web interface

## Screens / Pages
- Main App Shell — sidebar navigation with light/dark mode toggle, serves as container for all features
- Health Check — API endpoint confirms system is running

## API Surface
- Health — `/api/health` endpoint for system status checks
- Configuration — endpoints to read current source folder and work folder configuration
- Scanning — endpoints to trigger image scans, check scan progress, and view scan status

## Data Model
- Images — stores file paths, modification times, file sizes, and scanning status for all discovered image files
- Metadata — comprehensive EXIF, IPTC, GPS, and file metadata stored both as structured fields and raw JSON blobs
- Sources — configuration of named source folders that are scanned for images
- Work Folder — designated directory where Iris stores generated thumbnails and processed data

## User Flows
- System Startup — validates source folders are readable and work folder is writable, creates necessary directory structure
- Image Discovery — recursively scans configured source folders for supported image formats (JPEG, PNG, TIFF, WebP, HEIC, RAW formats)
- Metadata Extraction — processes discovered images using exifr library to extract camera settings, GPS coordinates, and file information
- Incremental Scanning — subsequent scans skip unchanged files and detect removed files without deleting database records

## Known Limitations
- No user interface for browsing extracted images or metadata yet
- No thumbnail generation implemented
- Configuration is setup-time only via files/environment variables, no runtime settings UI
- No image filtering, searching, or sorting capabilities
- Missing files are flagged but no UI to handle or review them