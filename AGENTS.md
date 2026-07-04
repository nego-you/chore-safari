<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# デザインプリンシプル

機能追加・削除・UI変更はすべて `docs/DESIGN_PRINCIPLES.md` の5原則に照らして判断すること。要約:

1. 現実(リアル)が主役、デジタルは「ごほうび」 — コインの主獲得源は現実のお手伝い
2. 「ハマりすぎない」健康的な距離感 — 1日のプレイに明確な上限、無限周回要素を作らない
3. 迷わない、一直線の「コアループ」 — お手伝い → コイン → 罠 → 図鑑 に UI を集中
4. 学びを「作業」ではなく「冒険の鍵」にする — クイズはゲーム進行と直結させる
5. 摩擦を減らし、達成感を即座に — タップ数最小限、無駄なモーダル・階層を挟まない
