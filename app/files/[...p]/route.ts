import fs from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { contentTypeFor, resolveSafePath, toWebReadable } from "@/lib/server/fs-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ p?: string[] }> }) {
  try {
    const { p } = await ctx.params
    const segments = (p || []).map((s) => s)

    // If the last segment accidentally contains a query (e.g. name.png?v=123),
    // strip it defensively to avoid file lookup failures.
    if (segments.length) {
      const last = segments[segments.length - 1]
      const [clean] = last.split("?")
      segments[segments.length - 1] = clean
    }

    const absPath = resolveSafePath(segments)

    const stat = await fs.promises.stat(absPath).catch(() => null)
    if (!stat || !stat.isFile()) {
      return new NextResponse("Not found", { status: 404 })
    }

    const stream = fs.createReadStream(absPath)
    const webStream = toWebReadable(stream) as ReadableStream
    const type = contentTypeFor(path.basename(absPath))

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(stat.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
