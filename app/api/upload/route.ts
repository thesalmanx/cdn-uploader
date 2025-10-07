import { NextResponse } from "next/server"
import path from "node:path"
import fsp from "node:fs/promises"
import {
  MAX_FILE_BYTES,
  ensureDir,
  ensureUniqueFileName,
  ensureUploadsRoot,
  resolveSafePath,
  sanitizeName,
  sanitizeSegments,
} from "@/lib/server/fs-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    // Debug logs help identify failures in preview. Remove once stable.
    console.log("[v0] /api/upload: start")

    await ensureUploadsRoot()
    const form = await req.formData()

    // files[] can be appended as files or files[]
    const files = form.getAll("files[]").concat(form.getAll("files")).filter(Boolean) as File[]
    console.log("[v0] /api/upload: files count =", files?.length ?? 0)

    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No files found in formData (files[])" }, { status: 400 })
    }

    const targetRaw = (form.get("target") as string) || ""
    const targetSegments = sanitizeSegments(targetRaw)

    // Optional per-file paths[] (aligns by index with files[])
    const pathsRaw = form.getAll("paths[]").map((v) => String(v))
    const saved: Array<{ name: string; url: string; size: number }> = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate size only (we now accept all types)
      if (file.size > MAX_FILE_BYTES) {
        console.log("[v0] /api/upload: skip oversized file", file.name, file.size)
        continue
      }

      const orig = file.name || "upload"
      const declaredMime = (file.type || "").toLowerCase()
      const extOnName = path.extname(orig).toLowerCase()
      const inferredMime = extToMime(extOnName)
      const mime = declaredMime || inferredMime

      // Determine subpath (target + optional per-file path)
      const perFilePath = pathsRaw[i]
      const perFileSegments = sanitizeSegments(perFilePath)
      const fullSegments = [...targetSegments, ...perFileSegments]

      const dirAbs = resolveSafePath(fullSegments)
      await ensureDir(dirAbs)

      // Sanitize filename, preserve/derive extension (default to .bin if none)
      const ext = extOnName || mimeToExt(mime) || ".bin"
      const base = sanitizeName(path.basename(orig, path.extname(orig)))
      const safeName = await ensureUniqueFileName(dirAbs, base + ext)

      const arrayBuffer = await file.arrayBuffer()
      const buf = Buffer.from(arrayBuffer)
      await fsp.writeFile(path.join(dirAbs, safeName), buf, { flag: "wx" })

      const urlPath = ["/files", ...fullSegments.map(encodeURIComponent), encodeURIComponent(safeName)].join("/")
      saved.push({ name: safeName, url: urlPath, size: buf.length })
    }

    console.log("[v0] /api/upload: saved count =", saved.length)
    return NextResponse.json({ ok: true, saved })
  } catch (err) {
    // Better error logging for debugging
    console.error("[v0] /api/upload: error", (err as Error)?.message, (err as Error)?.stack)
    return NextResponse.json({ ok: false, error: (err as Error).message || "Upload failed" }, { status: 500 })
  }
}

// ext->mime helper for fallback when file.type is empty
function extToMime(ext: string) {
  switch ((ext || "").toLowerCase()) {
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
      return "text/plain"
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
    default:
      return ""
  }
}

function mimeToExt(m: string) {
  switch ((m || "").toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg"
    case "image/png":
      return ".png"
    case "image/webp":
      return ".webp"
    case "image/gif":
      return ".gif"
    case "image/svg+xml":
      return ".svg"
    case "image/avif":
      return ".avif"
    case "application/pdf":
      return ".pdf"
    case "text/plain":
      return ".txt"
    case "application/json":
      return ".json"
    case "text/csv":
      return ".csv"
    case "video/mp4":
      return ".mp4"
    case "video/webm":
      return ".webm"
    case "video/quicktime":
      return ".mov"
    case "video/x-matroska":
      return ".mkv"
    case "audio/mpeg":
      return ".mp3"
    case "audio/wav":
      return ".wav"
    case "audio/ogg":
      return ".ogg"
    case "application/zip":
      return ".zip"
    default:
      return ""
  }
}
