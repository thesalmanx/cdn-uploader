import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

export const UPLOADS_ROOT = path.join(process.cwd(), "uploads")

export const ALLOWED_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  // Common aliases
  "image/jpg",
])

export const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB

export function ensureUploadsRootSync() {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true })
  }
}

export async function ensureUploadsRoot() {
  await fsp.mkdir(UPLOADS_ROOT, { recursive: true })
}

// Sanitize a single filename or folder segment to [a-zA-Z0-9_-]
export function sanitizeName(input: string): string {
  const base = (input || "").trim()
  const replaced = base.replace(/[^a-zA-Z0-9_-]/g, "_")
  const trimmed = replaced.replace(/^_+|_+$/g, "")
  return trimmed || "file"
}

// Split a path string into sanitized segments
export function sanitizeSegments(maybePath: string | undefined | null): string[] {
  if (!maybePath) return []
  const parts = maybePath.split("/").map(sanitizeName).filter(Boolean)
  // disallow traversal artifacts explicitly even after sanitize
  return parts.filter((seg) => seg !== "." && seg !== "..")
}

// Resolve a safe absolute path under UPLOADS_ROOT from provided path segments
export function resolveSafePath(segments: string[]): string {
  const abs = path.resolve(UPLOADS_ROOT, ...segments)
  // Ensure the resolved path stays within uploads root
  const root = path.resolve(UPLOADS_ROOT)
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("Unsafe path")
  }
  return abs
}

// Ensure a directory exists
export async function ensureDir(absDir: string) {
  await fsp.mkdir(absDir, { recursive: true })
}

// Return a unique filename within a directory (appends -1, -2, ...)
export async function ensureUniqueFileName(absDir: string, rawName: string) {
  const ext = path.extname(rawName)
  const base = sanitizeName(path.basename(rawName, ext))
  const safeExt = sanitizeExt(ext)
  let candidate = base + safeExt
  let i = 1
  while (true) {
    try {
      await fsp.access(path.join(absDir, candidate), fs.constants.F_OK)
      candidate = `${base}-${i}${safeExt}`
      i++
    } catch {
      return candidate
    }
  }
}

// Allow arbitrary extensions instead of image-only, default to .bin
function sanitizeExt(ext: string) {
  const lower = (ext || "").toLowerCase()
  if (!lower) return ".bin"
  // Allow letters/numbers up to 10 chars after the dot
  if (/^\.[a-z0-9]{1,10}$/.test(lower)) {
    return lower
  }
  return ".bin"
}

// Expand content-type mapping for common docs/audio/video; keep fallback
export function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    case ".webp":
      return "image/webp"
    case ".gif":
      return "image/gif"
    case ".svg":
      return "image/svg+xml"
    case ".avif":
      return "image/avif"
    case ".pdf":
      return "application/pdf"
    case ".txt":
      return "text/plain; charset=utf-8"
    case ".json":
      return "application/json"
    case ".csv":
      return "text/csv"
    case ".mp4":
      return "video/mp4"
    case ".webm":
      return "video/webm"
    case ".mov":
      return "video/quicktime"
    case ".mkv":
      return "video/x-matroska"
    case ".mp3":
      return "audio/mpeg"
    case ".wav":
      return "audio/wav"
    case ".ogg":
      return "audio/ogg"
    case ".zip":
      return "application/zip"
    case ".gz":
      return "application/gzip"
    case ".doc":
      return "application/msword"
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    case ".xls":
      return "application/vnd.ms-excel"
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    case ".ppt":
      return "application/vnd.ms-powerpoint"
    case ".pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    default:
      return "application/octet-stream"
  }
}

// Node Readable to Web ReadableStream
export function toWebReadable(nodeStream: fs.ReadStream) {
  // Node 18+ supports Readable.toWeb
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Readable as any).toWeb ? (Readable as any).toWeb(nodeStream) : nodeToWeb(nodeStream)
}

// Fallback conversion if needed
function nodeToWeb(nodeStream: fs.ReadStream) {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk))
      nodeStream.on("end", () => controller.close())
      nodeStream.on("error", (err) => controller.error(err))
    },
    cancel() {
      nodeStream.destroy()
    },
  })
}

// List first-level folders under uploads (directories only)
export async function listFolders(): Promise<string[]> {
  await ensureUploadsRoot()
  const entries = await fsp.readdir(UPLOADS_ROOT, { withFileTypes: true })
  return entries.filter((d) => d.isDirectory()).map((d) => d.name)
}

// List files within a folder path (non-recursive)
export async function listFilesIn(segments: string[]): Promise<{ name: string; size: number }[]> {
  const absDir = resolveSafePath(segments)
  const exists = await existsAsync(absDir)
  if (!exists) return []
  const entries = await fsp.readdir(absDir, { withFileTypes: true })
  const out: { name: string; size: number }[] = []
  for (const e of entries) {
    if (e.isFile()) {
      const st = await fsp.stat(path.join(absDir, e.name))
      out.push({ name: e.name, size: st.size })
    }
  }
  return out
}

async function existsAsync(p: string) {
  try {
    await fsp.access(p, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}
