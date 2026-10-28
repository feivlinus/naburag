export interface DocumentRecord {
  id: number;
  source_file: string;
  file_type: string;
  file_hash: string;
  section_count: number;
  chunk_count: number;
  ingested_at: string;
}

export interface ChunkRecord {
  chunk_id: string;
  section_number: number;
  heading: string;
  content: string;
}

export interface Citation {
  source_file: string;
  heading: string;
  section_number: number;
  quote_or_reason?: string;
}

export interface RetrievedChunk {
  chunk_id: string;
  source_file: string;
  heading: string;
  section_number: number;
  content: string;
  score: number;
}

export interface RagResponse {
  abstained: boolean;
  answer: string;
  citations: Citation[];
  retrieved_chunks: RetrievedChunk[];
  latency_ms?: number;
}

export interface EvalCaseResult {
  id: string | number;
  question: string;
  passed: boolean;
  retrieval_hit: boolean;
  abstained: boolean;
  cited_sources: string[];
  answer: string;
}

export interface EvalSummary {
  run_id: string | null;
  run_at: string | null;
  total_questions: number;
  passed_count: number;
  pass_rate: number;
  retrieval_hit_rate: number;
  abstention_accuracy: number;
  results: EvalCaseResult[];
}

const API_BASE = "/api";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchDocuments(): Promise<DocumentRecord[]> {
  return request<DocumentRecord[]>("/docs");
}

export async function fetchDocumentChunks(id: number): Promise<ChunkRecord[]> {
  return request<ChunkRecord[]>(`/docs/${id}/chunks`);
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append("file", file);
  return request<DocumentRecord>("/docs/upload", {
    method: "POST",
    body: formData,
  });
}

export async function syncDocuments(): Promise<{ success: boolean; ingestedCount: number; skippedCount: number }> {
  return request<{ success: boolean; ingestedCount: number; skippedCount: number }>("/docs/sync", {
    method: "POST",
  });
}

export async function deleteDocument(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/docs/${id}`, {
    method: "DELETE",
  });
}

export async function askQuestion(question: string, source_file?: string): Promise<RagResponse> {
  return request<RagResponse>("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, source_file: source_file || undefined }),
  });
}

export async function fetchEvalSummary(): Promise<EvalSummary> {
  return request<EvalSummary>("/eval");
}

export async function runEval(): Promise<EvalSummary> {
  return request<EvalSummary>("/eval/run", {
    method: "POST",
  });
}
