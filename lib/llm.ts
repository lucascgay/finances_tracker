import { EXTRACTION_SYSTEM_PROMPT } from "./prompt";
import { ExtractionResponseSchema } from "./extract";

type Provider = "ollama" | "openai";

interface LlmConfig {
  provider: Provider;
  ollamaBaseUrl: string;
  ollamaModel: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
}

function config(): LlmConfig {
  const provider = (process.env.LLM_PROVIDER ?? "ollama") as Provider;
  return {
    provider,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.1",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

/**
 * The user message we send alongside the system prompt. It embeds the JSON
 * shape (one example) and then the raw text to parse.
 */
export function buildUserMessage(rawText: string): string {
  const today = new Date().toISOString().slice(0, 10); // e.g. "2026-09-03"
  return `Today's date is ${today}.

Parse ALL transactions from the following raw text.

Return JSON conforming EXACTLY to this shape:
{"transactions":[{"date":"YYYY-MM-DD","description":"text","merchant":"text","amount":-12.34,"category":"Groceries","sourceType":"ManualPaste"}]}

The allowed categories are: Groceries, Dining_Coffee, Rent, Gas_Transportation,
Home_Supplies, Utilities_Housing, Subscriptions_Gym, Entertainment_Personal,
Income_Credit, Uncategorized.

RAW TEXT START
${rawText}
RAW TEXT END`;
}

async function callOllama(cfg: LlmConfig, rawText: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.ollamaModel,
        stream: false,
        format: "json", // force JSON output when the model supports it
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(rawText) },
        ],
      }),
    });
  } catch {
    throw new Error(
      `Could not reach Ollama at ${cfg.ollamaBaseUrl}. Start it with "ollama serve" (and "ollama pull ${cfg.ollamaModel}"), or set LLM_PROVIDER="openai" in .env.`
    );
  }
  if (!res.ok) {
    throw new Error(`Ollama request failed (${res.status}). Is Ollama running?`);
  }
  const data = await res.json();
  const content: string = data?.message?.content ?? "";
  return stripFences(content);
}

async function callOpenAi(cfg: LlmConfig, rawText: string): Promise<string> {
  if (!cfg.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  const res = await fetch(`${cfg.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: cfg.openaiModel,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(rawText) },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  return stripFences(content);
}

/** Remove stray markdown code fences a model might add around JSON. */
function stripFences(s: string): string {
  return s.replace(/```json/gi, "").replace(/```/g, "").trim();
}

/**
 * Send raw text to the configured LLM and return validated, normalized rows.
 * Throws a human-readable error on failure.
 */
export async function extractTransactions(rawText: string) {
  const cfg = config();
  if (!rawText.trim()) throw new Error("No text provided to parse.");

  const content =
    cfg.provider === "ollama"
      ? await callOllama(cfg, rawText)
      : await callOpenAi(cfg, rawText);

  // The model may wrap the array or return an object; try to parse both.
  const parsed = JSON.parse(content);
  const candidate = Array.isArray(parsed)
    ? { transactions: parsed }
    : parsed && typeof parsed === "object" && "transactions" in parsed
      ? parsed
      : { transactions: [] };

  return ExtractionResponseSchema.parse(candidate);
}
