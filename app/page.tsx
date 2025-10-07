import FolderBrowser from "@/components/folder-browser"
import UploadDropzone from "@/components/upload-dropzone"
import FileGrid from "@/components/file-grid"

export default function HomePage() {
  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-balance">Image Uploader</h1>
      </header>

      <section className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <FolderBrowser />
        </div>
        <div className="md:col-span-2 space-y-4">
          <UploadDropzone />
          <FileGrid />
        </div>
      </section>
    </main>
  )
}
