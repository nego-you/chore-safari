// ローカルで稼働している Ollama API への薄いクライアント。
//   OLLAMA_HOST  : 例) http://localhost:11434
//   OLLAMA_MODEL : 例) llama3.2 / qwen2.5:3b など
// 値が無ければデフォルトを使う。

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OllamaChatResult =
  | { ok: true; content: string; model: string }
  | { ok: false; error: string };

export const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
// 生成にかける最大時間。子供を待たせ過ぎないよう短め（25秒）。
export const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 25_000);

// Ollama の /api/chat を呼ぶ。format=json で JSON 出力を強制する。
export async function ollamaChat(
  messages: OllamaChatMessage[],
  opts: { model?: string; timeoutMs?: number; json?: boolean } = {},
): Promise<OllamaChatResult> {
  const model = opts.model ?? OLLAMA_MODEL;
  const timeoutMs = opts.timeoutMs ?? OLLAMA_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        // format=json は Ollama 0.1.34+ で JSON 出力を強制
        ...(opts.json !== false ? { format: "json" } : {}),
        options: {
          // 創造性は中程度。クイズは毎回少し違ってほしいが破綻させたくない。
          temperature: 0.6,
          top_p: 0.9,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Ollama HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      message?: { content?: string };
      done?: boolean;
    };
    const content = data.message?.content ?? "";
    if (!content) return { ok: false, error: "Ollama returned empty content" };
    return { ok: true, content, model };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Ollama timeout" };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
