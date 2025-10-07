import { NextResponse } from "next/server"
import { ensureUploadsRoot, listFolders } from "@/lib/server/fs-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await ensureUploadsRoot()
    const folders = await listFolders()
    return NextResponse.json({ ok: true, folders })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
