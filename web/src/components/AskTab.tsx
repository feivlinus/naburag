import { useState, type KeyboardEvent } from "react";
import { Search, Loader2, FileText, CheckCircle2, AlertCircle, Quote } from "lucide-react";
import { askQuestion, DocumentRecord, RagResponse } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AskTabProps {
  documents: DocumentRecord[];
}

const SAMPLE_QUESTIONS = [
  "What risk categories are defined under the EU AI Act?",
  "Wie lautet die Definition des IT-Sicherheitsvorfalls laut BSI IT-Grundschutz?",
  "What is the penalty for interstellar hyperdrive violations in 2045?",
];

export function AskTab({ documents }: AskTabProps) {
  const [question, setQuestion] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RagResponse | null>(null);

  const handleAsk = async (queryText?: string) => {
    const q = queryText || question;
    if (!q.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await askQuestion(q.trim(), selectedDoc || undefined);
      setResult(resp);
    } catch (err: any) {
      setError(err?.message || "Failed to retrieve answer");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAsk();
    }
  };

  const handleSampleClick = (q: string) => {
    setQuestion(q);
    handleAsk(q);
  };

  return (
    <div className="space-y-6">
      {/* Query Bar */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Input
                placeholder="Ask a question across your documents..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="pr-10"
              />
            </div>
            <div className="w-full md:w-64">
              <Select
                value={selectedDoc}
                onChange={(e) => setSelectedDoc(e.target.value)}
                disabled={loading}
              >
                <option value="">All Documents ({documents.length})</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.source_file}>
                    {d.source_file}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={() => handleAsk()} disabled={loading || !question.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Ask
                </>
              )}
            </Button>
          </div>

          {/* Quick Questions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-500 font-medium">Sample Queries:</span>
            {SAMPLE_QUESTIONS.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSampleClick(sq)}
                disabled={loading}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full transition-colors truncate max-w-xs"
              >
                {sq}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results view */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Grounded Answer & Citations */}
          <div className="lg:col-span-7 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2">
                  Answer
                  {result.latency_ms !== undefined && (
                    <span className="text-xs font-normal text-slate-400">
                      ({result.latency_ms}ms)
                    </span>
                  )}
                </CardTitle>
                {result.abstained ? (
                  <Badge variant="warning" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Abstained — Not in Docs
                  </Badge>
                ) : (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Grounded Answer
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <p className="text-slate-800 leading-relaxed text-sm whitespace-pre-wrap">
                  {result.answer}
                </p>

                {/* Citations */}
                {result.citations.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Citations ({result.citations.length})
                    </h4>
                    <div className="space-y-2">
                      {result.citations.map((c, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-medium text-slate-700">
                            <span className="flex items-center gap-1.5 truncate">
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              {c.source_file}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0">
                              {c.heading || `Sec ${c.section_number}`}
                            </Badge>
                          </div>
                          {c.quote_or_reason && (
                            <p className="text-slate-600 italic flex items-start gap-1 pt-1">
                              <Quote className="h-3 w-3 shrink-0 text-slate-400 mt-0.5" />
                              <span>{c.quote_or_reason}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Retrieved Qdrant Chunks */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center justify-between">
              <span>Retrieved Top Chunks</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {result.retrieved_chunks.length} chunks
              </Badge>
            </h3>

            {result.retrieved_chunks.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No matching chunks retrieved.</p>
            ) : (
              <div className="space-y-3">
                {result.retrieved_chunks.map((chunk, idx) => {
                  const similarityPct = Math.round(chunk.score * 100);
                  return (
                    <Card key={chunk.chunk_id || idx} className="text-xs border-slate-200">
                      <CardHeader className="p-3 pb-2 bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={chunk.source_file}>
                            {chunk.source_file}
                          </span>
                          <span className="font-mono text-slate-600 font-medium">
                            {similarityPct}% match
                          </span>
                        </div>
                        <div className="pt-1">
                          <Progress value={similarityPct} className="h-1.5" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>{chunk.heading}</span>
                          <span>Section {chunk.section_number}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 font-mono text-[11px] text-slate-600 leading-normal max-h-36 overflow-y-auto whitespace-pre-wrap">
                        {chunk.content}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
