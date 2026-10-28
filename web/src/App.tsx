import { useState, useEffect } from "react";
import { MessageSquare, Files, CheckSquare, Database } from "lucide-react";
import { fetchDocuments, DocumentRecord } from "./api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { AskTab } from "./components/AskTab";
import { DocsTab } from "./components/DocsTab";
import { EvalTab } from "./components/EvalTab";

export default function App() {
  const [activeTab, setActiveTab] = useState("ask");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  const loadDocs = async () => {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              N
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">
                NabuRAG
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Deterministic Multi-Document RAG Pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="flex items-center gap-1.5 text-xs font-normal">
              <Database className="h-3 w-3 text-slate-500" />
              <span>{documents.length} Docs ({totalChunks} Chunks)</span>
            </Badge>
            <Badge variant="outline" className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border-emerald-200">
              Qdrant + Postgres + Bun
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-center mb-8">
            <TabsList className="grid grid-cols-3 w-full max-w-md h-11 p-1 bg-slate-200/70">
              <TabsTrigger value="ask" className="flex items-center gap-2 text-xs font-semibold">
                <MessageSquare className="h-4 w-4" />
                Ask & Inspect
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-2 text-xs font-semibold">
                <Files className="h-4 w-4" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="eval" className="flex items-center gap-2 text-xs font-semibold">
                <CheckSquare className="h-4 w-4" />
                Evaluation
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="ask">
            <AskTab documents={documents} />
          </TabsContent>

          <TabsContent value="docs">
            <DocsTab documents={documents} onRefresh={loadDocs} />
          </TabsContent>

          <TabsContent value="eval">
            <EvalTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        NabuRAG &bull; Bun native server &bull; React 19 &bull; shadcn/ui design &bull; bge-m3 embeddings
      </footer>
    </div>
  );
}
