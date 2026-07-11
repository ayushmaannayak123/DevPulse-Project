/**
 * =============================================================
 * DevPulse Node backend -- Backend-agnostic LLM client
 * Mirrors model_client.py's design: same interface whether talking to
 * local Ollama or cloud Groq. Both expose OpenAI-compatible endpoints,
 * so a single `openai` client instance works for either, just pointed
 * at a different baseURL.
 * =============================================================
 */

import OpenAI from "openai";

export interface LlmHandle {
  client: OpenAI;
  model: string;
  backend: "ollama" | "groq";
}

export function getLlmClient(): LlmHandle {
  const backend = (
    process.env.LLM_BACKEND || (process.env.GROQ_API_KEY ? "groq" : "ollama")
  ).toLowerCase() as "ollama" | "groq";

  if (backend === "groq") {
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
    return { client, model, backend };
  }

  // Ollama, via its OpenAI-compatible endpoint. apiKey is a
  // required-but-unchecked placeholder, same as the Python client.
  const client = new OpenAI({
    apiKey: "ollama",
    baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  });
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";
  return { client, model, backend };
}

export async function checkConnection(handle: LlmHandle): Promise<boolean> {
  try {
    await handle.client.chat.completions.create({
      model: handle.model,
      messages: [{ role: "user", content: "Say OK in one word" }],
      max_tokens: 5,
    });
    return true;
  } catch (err) {
    console.error(`[llmClient] Could not reach ${handle.backend}:`, (err as Error).message);
    return false;
  }
}
