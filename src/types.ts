export interface RawSection {
  source_file: string;
  section_number: number;
  heading: string;
  text: string;
}

export interface ChunkPayload {
  chunk_id: string;
  source_file: string;
  heading: string;
  section_number: number;
  content: string;
}

export interface Citation {
  source_file: string;
  section_number: number;
  heading: string;
}

export interface RagAnswer {
  abstained: boolean;
  answer: string;
  citations: Citation[];
}

export interface EvalCase {
  id: string | number;
  question: string;
  expected_answer?: string;
  ground_truth_doc?: string;
  should_abstain?: boolean;
}

export interface DocumentRecord {
  id?: number;
  source_file: string;
  file_type: string;
  file_hash: string;
  section_count: number;
  chunk_count: number;
  ingested_at?: Date;
}
