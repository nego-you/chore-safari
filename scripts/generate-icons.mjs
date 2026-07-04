// SVG（public/icon.svg）から PWA 用 PNG アイコンを生成する。
// @resvg/resvg-js が必要：npm i -D @resvg/resvg-js
//
// 出力：
//   public/icon-192x192.png      （Android / Chrome 用）
//   public/icon-512x512.png      （スプラッシュ用）
//   public/apple-touch-icon.png  （iOS / iPadOS の「ホーム画面に追加」用）
//
// 使い方：
//   node scripts/generate-icons.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SVG_PATH = join(ROOT, "public", "icon.svg");

if (!existsSync(SVG_PATH)) {
  console.error("public/icon.svg が見つかりません");
  process.exit(1);
}

let Resvg;
try {
  ({ Resvg } = await import("@resvg/resvg-js"));
} catch {
  console.error(
    "@resvg/resvg-js が入っていません。`npm install -D @resvg/resvg-js` を先に実行してください。",
  );
  process.exit(1);
}

const svg = readFileSync(SVG_PATH);

function render(size) {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "transparent",
  });
  return r.render().asPng();
}

const targets = [
  { file: "icon-192x192.png", size: 192 },
  { file: "icon-512x512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  const out = join(ROOT, "public", t.file);
  writeFileSync(out, render(t.size));
  console.log(`✓ ${t.file} (${t.size}x${t.size})`);
}

console.log("\nDone.");
