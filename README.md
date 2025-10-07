# Next.js Uploads App

A Next.js 14 (App Router, TypeScript, Tailwind) app that stores user-uploaded images on the server under `/uploads` (not `/public`), with secure APIs and a UI to browse, upload, and delete files.

## Features

- Server-side storage under `/uploads`
- POST `/api/upload` accepts `formData` with `files[]`, optional `paths[]`, and `target` folder
  - Sanitizes names to `[a-zA-Z0-9_-]`
  - Enforces MIME types: jpeg, png, webp, gif, svg, avif
  - 20 MB max per file
  - Ensures unique filenames
  - Returns `{ ok, saved: [{ name, url, size }] }` with URLs like `/files/{folder}/{name}`
- GET `/files/[...p]` streams files from `/uploads` with correct `Content-Type`
  - `export const runtime = "nodejs"` and `dynamic = "force-dynamic"`
- Library APIs
  - GET `/api/folders` – list top-level folders
  - GET `/api/list?folder=...` – list files and sizes in a folder
  - DELETE `/api/delete` – delete files by `paths[]`
  - All endpoints are traversal-safe
- UI
  - Folder browser and manual folder selection
  - Drag-drop multi-upload with previews
  - Grid of cards (name, size, “Open”), select + delete
  - Builds file URLs using the API and `encodeURIComponent`; adds `?v=Date.now()` after upload to bust cache

## Development

- Install: `yarn`
- Dev: `yarn dev`
- Build: `yarn build`
- Start: `yarn start`

This project runs in the Next.js App Router environment. Deploy to Vercel for best results. Use the “Publish” button in v0, or download and run locally with yarn.

## Notes

- Files are served from `/files/...` and stored on disk under `/uploads`.
- Only image types are accepted. Oversized or invalid files are skipped.
- Filenames are sanitized and made unique if collisions occur.
