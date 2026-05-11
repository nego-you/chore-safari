// SDK レイヤの疎通テスト。Route Handler を経由せずに直接 Gemini を叩く。
//
// 使い方（コンテナ内で実行）:
//   docker compose exec web node scripts/test-gemini.mjs
//
// 期待する結果:
//   ✅ API key set ...
//   ✅ generateText OK: ...
//   ✅ streamText OK
//
// よくある失敗:
//   - "API key not valid"      → GEMINI_API_KEY が間違っている
//   - "models/.../not found"   → GEMINI_MODEL の名前が間違い、もしくは廃止モデル
//   - "fetch failed"           → コンテナから outbound 443 が出られない

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, streamText } from "ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY is not set in the container env");
  process.exit(1);
}

console.log(`✅ API key set (${apiKey.slice(0, 6)}…), model = ${model}`);

const google = createGoogleGenerativeAI({ apiKey });

console.log("\n→ generateText test...");
try {
  const { text } = await generateText({
    model: google(model),
    prompt: "「テスト成功！」と一言だけ、日本語で返してください。",
  });
  console.log("✅ generateText OK:", text.replace(/\n/g, " "));
} catch (err) {
  console.error("❌ generateText failed:", err?.message || err);
  if (err?.cause) console.error("   cause:", err.cause);
  process.exit(1);
}

console.log("\n→ streamText test...");
try {
  const result = streamText({
    model: google(model),
    prompt: "「1, 2, 3」とだけ日本語で出力してください。",
    onError({ error }) {
      console.error("   onError:", error?.message || error);
    },
  });
  let acc = "";
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    acc += chunk;
  }
  process.stdout.write("\n");
  if (!acc.trim()) {
    console.error("❌ streamText returned empty body");
    process.exit(1);
  }
  console.log("✅ streamText OK");
} catch (err) {
  console.error("❌ streamText failed:", err?.message || err);
  process.exit(1);
}

console.log("\n🎉 All Gemini tests passed.");
