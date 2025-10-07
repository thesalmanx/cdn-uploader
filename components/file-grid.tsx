"use client"

import useSWR from "swr"
import { useEffect, useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type FileItem = { name: string; size: number; url: string }

export default function FileGrid() {
  const [folder, setFolder] = useState<string>("")
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const key = "/api/list?folder=" + encodeURIComponent(folder || "")
  const { data, mutate, isLoading } = useSWR<{ ok: boolean; files: FileItem[] }>(key, fetcher)

  useEffect(() => {
    const initial = typeof window !== "undefined" ? sessionStorage.getItem("selectedFolder") || "" : ""
    setFolder(initial)
    const onFolderChange = () => {
      const next = typeof window !== "undefined" ? sessionStorage.getItem("selectedFolder") || "" : ""
      setFolder(next)
      setSelected({})
    }
    window.addEventListener("folder-change", onFolderChange as EventListener)
    return () => window.removeEventListener("folder-change", onFolderChange as EventListener)
  }, [])

  // refresh when version changes after upload
  useEffect(() => {
    const onStorage = () => mutate()
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [mutate])

  const files = data?.files ?? []

  async function deleteSelected() {
    const paths = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([name]) => [folder, name].filter(Boolean).join("/"))
    if (!paths.length) return
    const res = await fetch("/api/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    })
    if (res.ok) {
      setSelected({})
      mutate()
    } else {
      console.error("[v0] Delete error:", await res.text())
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">
          Files in <span className="font-mono">{folder || "(root)"}</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => mutate()} disabled={isLoading}>
            Refresh
          </Button>
          <Button variant="destructive" onClick={deleteSelected} disabled={!Object.values(selected).some(Boolean)}>
            Delete Selected
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && files.length === 0 && (
          <p className="text-sm text-muted-foreground">No files found in this folder.</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {files.map((f) => {
            const cacheBustedUrl = withCacheBust(f.url, Date.now())
            const checked = !!selected[f.name]
            const isImg = isImageName(f.name) // only show thumbnail for images
            return (
              <div key={f.name} className="border rounded-lg overflow-hidden flex flex-col">
                {isImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cacheBustedUrl || "/placeholder.svg"}
                    alt={f.name}
                    className="w-full h-40 object-cover bg-muted"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center bg-muted">
                    <span className="text-xs">{(f.name.split(".").pop() || "").toUpperCase() || "FILE"}</span>
                  </div>
                )}
                <div className="p-2 flex-1">
                  <p className="text-xs break-all">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                </div>
                <CardFooter className="flex items-center justify-between">
                  <a
                    href={cacheBustedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                    aria-label={`Open ${f.name}`}
                  >
                    Open
                  </a>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [f.name]: !!v }))}
                      aria-label={`Select ${f.name}`}
                    />
                    <span className="text-xs">Select</span>
                  </div>
                </CardFooter>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function withCacheBust(pathname: string, v: number) {
  try {
    const u = new URL(pathname, window.location.origin)
    u.searchParams.set("v", String(v))
    // return as relative URL
    return u.pathname + (u.search ? "?" + u.searchParams.toString() : "")
  } catch {
    const sep = pathname.includes("?") ? "&" : "?"
    return `${pathname}${sep}v=${v}`
  }
}

function isImageName(name: string) {
  const ext = (name.split(".").pop() || "").toLowerCase()
  return ["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"].includes(ext)
}
