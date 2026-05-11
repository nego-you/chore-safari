// Route Handler 経由の疎通テスト。dev サーバ (http://localhost:3000) を叩く。
//
// 使い方（コンテナ内で実行）:
//   docker compose exec web node scripts/test-race-api.mjs
//
// チェック項目:
//   1. GET /api/race  → apiKeyPresent: true, model 名が想定どおりか
//   2. POST /api/race → 200 + 本文に何らかの実況テキストが流れること

const BASE = process.env.RACE_API_BASE || "http://localhost:3000";

console.log(`→ GET ${BASE}/api/race`);
const diag = await fetch(`${BASE}/api/race`);
console.log("  status:", diag.status);
const diagJson = await diag.json().catch(() => null);
console.log("  body  :", diagJson);
if (!diag.ok || !diagJson?.apiKeyPresent) {
  console.error("❌ Diagnostic failed (API key missing?)");
  process.exit(1);
}

console.log(`\n→ POST ${BASE}/api/race`);
const res = await fetch(`${BASE}/api/race`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    animals: [
      { name: "ライオン", description: "ひゃくじゅうの王。たてがみがかっこいい" },
      { name: "うさぎ", description: "ふわふわ。あしがはやい" },
    ],
  }),
});
console.log("  status      :", res.status);
console.log("  content-type:", res.headers.get("content-type"));

if (!res.ok) {
  console.error("❌ POST returned error body:", await res.text());
  process.exit(1);
}
if (!res.body) {
  console.error("❌ POST response has no body");
  process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();
let total = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  process.stdout.write(chunk);
  total += chunk;
}
process.stdout.write("\n");

if (!total.trim()) {
  console.error("❌ POST stream was empty");
  process.exit(1);
}
if (total.includes("[実況エラー]")) {
  console.error("❌ Server reported stream error (see body above)");
  process.exit(1);
}

console.log(`\n✅ Got ${total.length} chars of commentary.`);
