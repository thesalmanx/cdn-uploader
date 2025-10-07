import fsp from "node:fs/promises"
import { NextResponse } from "next/server"
import { resolveSafePath, sanitizeSegments } from "@/lib/server/fs-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { paths?: string[] }
    const paths = Array.isArray(body.paths) ? body.paths : []

    const deleted: string[] = []
    const errors: Array<{ path: string; error: string }> = []

    for (const p of paths) {
      try {
        const segs = sanitizeSegments(p)
        if (!segs.length) continue
        const abs = resolveSafePath(segs)
        const st = await fsp.stat(abs).catch(() => null)
        if (!st || !st.isFile()) {
          errors.push({ path: p, error: "Not found" })
          continue
        }
        await fsp.unlink(abs)
        deleted.push(p)
      } catch (e) {
        errors.push({ path: p, error: (e as Error).message })
      }
    }

    return NextResponse.json({ ok: true, deleted, errors })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
