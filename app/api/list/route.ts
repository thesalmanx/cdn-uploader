import { NextResponse } from "next/server"
import { listFilesIn, sanitizeSegments } from "@/lib/server/fs-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const folderRaw = searchParams.get("folder") || ""
    const segments = sanitizeSegments(folderRaw)
    const files = await listFilesIn(segments)

    return NextResponse.json({
      ok: true,
      files: files.map((f) => ({
        name: f.name,
        size: f.size,
        url: ["/files", ...segments.map(encodeURIComponent), encodeURIComponent(f.name)].join("/"),
      })),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
