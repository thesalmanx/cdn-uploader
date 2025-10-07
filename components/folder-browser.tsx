"use client"

import useSWR from "swr"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function FolderBrowser() {
  const { data, mutate } = useSWR<{ ok: boolean; folders: string[] }>("/api/folders", fetcher)
  const [selected, setSelected] = useState<string>("")
  const [manual, setManual] = useState<string>("")

  useEffect(() => {
    const stored = sessionStorage.getItem("selectedFolder") || ""
    setSelected(stored)
    setManual(stored)
  }, [])

  useEffect(() => {
    sessionStorage.setItem("selectedFolder", selected)
  }, [selected])

  const folders = data?.folders ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Folders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Target folder (e.g. gallery, or nested like cats/2025)"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <Button
            onClick={() => {
              setSelected(manual.trim())
              // refresh list on change
              window.dispatchEvent(new CustomEvent("folder-change"))
            }}
          >
            Use
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {folders.length === 0 && <span className="text-sm text-muted-foreground">No folders yet</span>}
          {folders.map((f) => (
            <Button
              key={f}
              variant={selected === f ? "default" : "secondary"}
              onClick={() => {
                setSelected(f)
                setManual(f)
                window.dispatchEvent(new CustomEvent("folder-change"))
              }}
              className="text-sm"
            >
              {f || "(root)"}
            </Button>
          ))}
          <Button variant="outline" onClick={() => mutate()} className="text-sm">
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Current target: <span className="font-mono">{selected || "(root)"}</span>
        </p>
      </CardContent>
    </Card>
  )
}
