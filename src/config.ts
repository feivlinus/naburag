import { z } from "zod";

const EnvSchema = z.object({
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string().default("rag"),
  POSTGRES_PASSWORD: z.string().default("ragpassword"),
  POSTGRES_DB: z.string().default("ragdb"),

  QDRANT_URL: z.string().default("http://localhost:6333"),

  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  EMBEDDING_MODEL: z.string().default("bge-m3"),

  LLM_BASE_URL: z.string().default("http://localhost:11434"),
  LLM_MODEL: z.string().default("llama3.2"),
});

export const config = EnvSchema.parse(process.env);
