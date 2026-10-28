import { useState, useRef, type DragEvent } from "react";
import {
  Upload,
  RefreshCw,
  Trash2,
  Layers,
  FileCode,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle,
} from "lucide-react";
import {
  DocumentRecord,
  ChunkRecord,
  uploadDocument,
  syncDocuments,
  deleteDocument,
  fetchDocumentChunks,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetContent,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DocsTabProps {
  documents: DocumentRecord[];
  onRefresh: () => Promise<void>;
}

export function DocsTab({ documents, onRefresh }: DocsTabProps) {
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Chunk inspection sheet state
  const [inspectDoc, setInspectDoc] = useState<DocumentRecord | null>(null);
  const [inspectChunks, setInspectChunks] = useState<ChunkRecord[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSync = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      const res = await syncDocuments();
      setStatusMessage({
        type: "success",
        text: `Sync completed: ${res.ingestedCount} indexed, ${res.skippedCount} skipped.`,
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    setStatusMessage(null);
    try {
      const res = await uploadDocument(file);
      setStatusMessage({
        type: "success",
        text: `Uploaded and indexed "${res.source_file}" (${res.chunk_count} chunks).`,
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.source_file}"? This removes it from disk, PostgreSQL, and Qdrant.`)) {
      return;
    }

    setDeletingId(doc.id);
    setStatusMessage(null);
    try {
      await deleteDocument(doc.id);
      setStatusMessage({
        type: "success",
        text: `Deleted "${doc.source_file}".`,
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "Failed to delete document" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleInspect = async (doc: DocumentRecord) => {
    setInspectDoc(doc);
    setLoadingChunks(true);
    try {
      const chunks = await fetchDocumentChunks(doc.id);
      setInspectChunks(chunks);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "Failed to load chunks" });
    } finally {
      setLoadingChunks(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Dropzone & Action Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dropzone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`col-span-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center space-y-2 ${
            dragActive
              ? "border-slate-900 bg-slate-100/50"
              : "border-slate-300 hover:border-slate-400 bg-white"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.md,.txt,.docx,.html,.htm,.json"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleUploadFile(e.target.files[0]);
              }
              e.target.value = "";
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center space-y-2 py-4">
              <Loader2 className="h-8 w-8 text-slate-900 animate-spin" />
              <p className="text-sm font-medium text-slate-700">Chunking & Embedding Document...</p>
            </div>
          ) : (
            <>
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-slate-500">
                  Supports .pdf, .md, .txt, .docx, .html, .json
                </p>
              </div>
            </>
          )}
        </div>

        {/* Sync Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Corpus Synchronization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Scans <code>data/docs/</code> for new or changed files and indexes them via SHA-256 hash detection.
            </p>
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Scanning Directory..." : "Sync data/docs/"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <Alert variant={statusMessage.type === "error" ? "destructive" : "default"} className={statusMessage.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""}>
          {statusMessage.type === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          )}
          <AlertDescription>{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* Documents Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            Indexed Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No documents indexed yet. Drop files above or sync your <code>data/docs/</code> directory.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Sections / Pages</TableHead>
                  <TableHead className="text-right">Chunks</TableHead>
                  <TableHead>Ingested At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium text-slate-900 flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-slate-400" />
                      {doc.source_file}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase font-mono text-[10px]">
                        {doc.file_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{doc.section_count}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{doc.chunk_count}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(doc.ingested_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleInspect(doc)}
                        className="h-7 text-xs"
                      >
                        <Layers className="h-3.5 w-3.5 mr-1" />
                        Inspect Chunks
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(doc)}
                        disabled={deletingId === doc.id}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inspect Chunks Slide-Over Sheet */}
      <Sheet open={!!inspectDoc} onOpenChange={(open) => !open && setInspectDoc(null)}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-slate-600" />
            Chunks Inspector
          </SheetTitle>
          <SheetDescription>
            Browsing {inspectChunks.length} chunks stored in PostgreSQL & Qdrant for{" "}
            <span className="font-semibold text-slate-800">{inspectDoc?.source_file}</span>
          </SheetDescription>
        </SheetHeader>
        <SheetContent>
          {loadingChunks ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {inspectChunks.map((chunk, idx) => (
                <div
                  key={chunk.chunk_id || idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-semibold text-slate-800">{chunk.heading}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      Section {chunk.section_number}
                    </Badge>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 truncate">
                    ID: {chunk.chunk_id}
                  </div>
                  <p className="font-mono text-slate-700 leading-relaxed whitespace-pre-wrap bg-white p-2 rounded border border-slate-100">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
