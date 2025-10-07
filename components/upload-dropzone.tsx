"use client"

import { useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Preview = {
  file: File
  url: string
  error?: string
}

export default function UploadDropzone() {
  const [previews, setPreviews] = useState<Preview[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { mutate } = useSWRConfig()

  const [target, setTarget] = useState<string>("")
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    const initial = typeof window !== "undefined" ? sessionStorage.getItem("selectedFolder") || "" : ""
    setTarget(initial)
    const onFolderChange = () => {
      const next = typeof window !== "undefined" ? sessionStorage.getItem("selectedFolder") || "" : ""
      setTarget(next)
    }
    window.addEventListener("folder-change", onFolderChange as EventListener)
    return () => window.removeEventListener("folder-change", onFolderChange as EventListener)
  }, [])

  function onFiles(files: FileList | null) {
    if (!files) return
    const next: Preview[] = []
    for (const f of Array.from(files)) {
      next.push({ file: f, url: URL.createObjectURL(f) })
    }
    setPreviews((p) => [...p, ...next])
  }

  async function onUpload() {
    if (!previews.length || isUploading) return
    setUploadError(null)

    const fd = new FormData()
    for (const p of previews) {
      fd.append("files[]", p.file)
    }
    if (target) fd.append("target", target)

    setIsUploading(true)
    setUploadProgress(0)

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/upload", true)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(pct)
        }
      }

      xhr.onerror = () => {
        const msg = "Network error during upload"
        setUploadError(msg)
        console.error("[v0] Upload error:", msg)
        setIsUploading(false)
        resolve()
      }

      xhr.onload = () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Success
            const key = "/api/list?folder=" + encodeURIComponent(target || "")
            mutate(key)
            if (typeof window !== "undefined") {
              sessionStorage.setItem("files-version", String(Date.now()))
            }
            setPreviews([])
          } else {
            // Parse server error if possible
            let msg = "Upload failed"
            try {
              const parsed = JSON.parse(xhr.responseText || "{}")
              if (parsed?.error) msg = parsed.error
            } catch {
              // keep generic
            }
            setUploadError(msg)
            console.error("[v0] Upload error:", msg)
          }
        } finally {
          setIsUploading(false)
          resolve()
        }
      }

      xhr.send(fd)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer",
            dragOver ? "bg-accent" : "bg-card",
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            onFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          aria-label="Upload files by clicking or dragging files"
        >
          <p className="text-sm">Drag and drop files here, or click to select</p>
          <p className="text-xs text-muted-foreground mt-1">Any file type. Max 20 MB each.</p>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </div>

        {previews.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {previews.map((p, idx) => {
              const isImg = isImageFile(p.file)
              return (
                <div key={idx} className="border rounded-lg overflow-hidden">
                  {isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url || "/placeholder.svg"} alt="Preview" className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-muted">
                      <span className="text-xs">{(p.file.name.split(".").pop() || "").toUpperCase() || "FILE"}</span>
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs break-all">{p.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(p.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={onUpload} disabled={!previews.length || isUploading}>
            {isUploading ? `Uploading… ${uploadProgress}%` : `Upload ${previews.length ? `(${previews.length})` : ""}`}
          </Button>
          {previews.length > 0 && (
            <Button variant="secondary" onClick={() => setPreviews([])} disabled={isUploading}>
              Clear
            </Button>
          )}
        </div>

        {isUploading && (
          <div className="w-full">
            <div
              className="h-2 w-full rounded bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
            >
              <div className="h-2 rounded bg-primary" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{uploadProgress}%</p>
          </div>
        )}
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      </CardContent>
    </Card>
  )
}

function isImageFile(f: File) {
  const t = (f.type || "").toLowerCase()
  if (t.startsWith("image/")) return true
  const ext = (f.name.split(".").pop() || "").toLowerCase()
  return ["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"].includes(ext)
}
