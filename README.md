# Chore Safari（チョア・サファリ）

**「現実のお手伝いと成長が、デジタルの冒険に繋がる。」**

家族の子供たちが遊ぶ、お手伝い連動型の知育＆どうぶつ捕獲 Web プラットフォーム。
現実のお手伝い・学習・生活習慣の達成でコインを獲得し、そのコインでアイテムを集め、
さまざまな時代・生息地の動物や恐竜を捕まえて、家族共通の図鑑を完成させていきます。

> **対象ユーザー**: 家庭内（兄妹）での利用。3人の子供（美琴 / 幸仁 / 叶泰）と親アカウントを前提にしています。
> 公開は Cloudflare Tunnel 経由（`chore-safari.negoyou.com`）。

---

## コアサイクル

子供は **ワールドマップ**（[WorldMapPortal](app/kids/WorldMapPortal.tsx)）を拠点に、各施設を歩いて回ります。

1. **お手伝いと銀行（Quest & Bank）**
   - 親が設定したクエスト（おてつだい / おべんきょう / せいかつ）を子供が申請。
   - 親が **Bank 画面**で承認するとコインが付与される（特大ボーナス・ペナルティ没収あり）。
   - 連続達成で報酬が増える **ストリーク**機能を搭載。

2. **素材集めと工作（Crane & Craft）**
   - **クレーンゲーム**でコインを消費して素材（木の枝・石・鉄の欠片など）を獲得。
   - **クラフト工房**で素材を組み合わせ、罠・弓・槍などの道具を作る。
   - 道具は使い捨ての罠から繰り返し使えるアクティブ武器まで。

3. **狩りと図鑑（Safari & Dictionary）**
   - **罠スタイル（パッシブ）**: 罠とエサを仕掛けて待ち、出現した動物をタイミングゲームで捕獲。
   - **アクティブ狩り**: 弓・槍を持ち、ゲージ式タイミングで動物を捕獲（1日の回数制限あり）。
   - 捕まえた動物は家族共通の **博物図鑑**に記録される。

4. **動物とのくらし（House / Ranch / Zoo / Farm / Logistics）**
   - **自分の家**: 捕まえた動物が待つハブ。観察・親密度上げ・AI 会話を行う。
   - **牧場 / 動物園 / 農場 / 物流センター**: 動物を育てる・展示する・作物を収穫する・エサを配送する施設群。
   - **寿命と殿堂入り**: 動物には寿命があり、天寿を全うすると記録に残る。

5. **AI による体験拡張（Gemini）**
   - **早押しクイズ**: Gemini が幼児〜小学生向けの3形式（文章・漢字パズル・法則）× 3難易度の問題を動的生成。
   - **図鑑クイズ**: 図鑑の動物解説から Gemini が3択クイズを生成。
   - **AI ガイドキャラクター**: 相棒の動物が性格（パーソナリティ）を持ち、親密度に応じて Gemini 経由で対話。
     応答は **VOICEVOX**（ずんだもん）でフルボイス再生される。

6. **ミニゲーム（カオスレース）**
   - 捕まえた動物 5匹でベット式のレース。オッズ予想を当てるとコイン獲得。
     実況・進行はクライアント側の乱数で生成（LLM 不使用。詳細は [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) 参照）。

7. **おたがいさま（Kizuna Events）**
   - **ページを移動するたびに 5% の確率**で、こまっている人が画面中央に登場（ログイン時に限らない）。
   - **やさしい／ふつう／いじわる**の3択で答え、相手の顔（😊🙂😢）と反応が変化。
   - **やさしい**を選んだ時だけ「お返し」がたまり、後日 別のだれかが助けに来てくれる。

8. **演出（BGM / 天気）**
   - 画面ごとに自動で切り替わる BGM、ワールドマップの天気エフェクトを搭載。

---

## 技術スタック

| 区分 | 採用技術 |
|---|---|
| Frontend / Backend | **Next.js 16**（App Router, Server Actions）, React 19, TypeScript |
| スタイル / 演出 | Tailwind CSS v4, Framer Motion, canvas-confetti |
| 状態管理 | Zustand（`persist`／localStorage）, React Server Components |
| データベース | PostgreSQL 16 + Prisma 6 |
| LLM | **Google Gemini**（Vercel AI SDK `@ai-sdk/google`） |
| 音声合成（TTS） | **VOICEVOX**（FastAPI ブリッジ経由） |
| テスト | Playwright（E2E） |
| インフラ | Docker Compose（web / db / VOICEVOX / FastAPI / Cloudflare Tunnel） |

> ⚠️ AI は以前 Ollama を使用していましたが、現在は **Gemini に全面移行済み**で、Ollama 依存はコードから完全に削除されています。

---

## 起動方法

### 前提
- Node.js 20+ / Docker Desktop
- `.env` に最低限 `DATABASE_URL` と `GEMINI_API_KEY` を設定（[環境変数](#環境変数)参照）

### A. ローカル開発（DB と VOICEVOX のみ Docker、Next.js は手元で起動）

```bash
npm install

# PostgreSQL・VOICEVOX・FastAPI ブリッジを起動
npm run db:up        # docker compose up -d

# スキーマ適用とマスターデータ投入
npm run db:migrate   # prisma migrate dev
npm run db:seed      # マスターデータ（動物・道具・クエスト等）

# 開発サーバー
npm run dev          # http://localhost:3000
```

### B. フル Docker（本番相当）

`docker-compose.yml` で以下のサービスが起動します。

| サービス | 役割 | ポート |
|---|---|---|
| `web` | Next.js 開発サーバー（HMR） | 3000 |
| `web-prod` | `next build` 済みの本番ビルド | 3001 |
| `db` | PostgreSQL 16 | 5433→5432 |
| `voicevox_engine` | VOICEVOX 音声合成エンジン（CPU 版） | 内部 50021 |
| `backend` | FastAPI TTS ブリッジ（`/api/synthesize` の実体） | 内部 8000 |
| `cloudflared` | Cloudflare Tunnel（外部公開 → `web-prod`） | — |

> **Note**: クイズ・レース実況・AI ガイド対話には `GEMINI_API_KEY` が必須です。
> AI 会話の音声再生には VOICEVOX（`voicevox_engine` + `backend`）が必要です。
> いずれも未設定／停止時は該当機能がエラーまたは無音になります。

---

## 環境変数

`.env`（gitignore 済み）に設定します。`docker-compose.yml` の `environment` で上書きされる項目もあります。

| 変数 | 用途 | 例 / 既定 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 接続文字列 | `postgresql://chore:chore@localhost:5433/chore_safari?schema=public` |
| `GEMINI_API_KEY` | Google AI Studio の API キー（**必須**） | — |
| `GEMINI_MODEL` | 使用モデルを**固定したい時だけ**指定（任意） | 未指定なら `gemini-flash-latest`（常に最新の安定 flash）。既定は [lib/gemini.ts](lib/gemini.ts) に集約 |
| `BACKEND_URL` | FastAPI TTS ブリッジの URL | `http://backend:8000` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel 用トークン | — |

---

## npm スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` / `start` | 本番ビルド / 起動 |
| `npm run db:up` / `db:down` | Docker Compose 起動 / 停止 |
| `npm run db:migrate` / `db:reset` | マイグレーション適用 / リセット |
| `npm run db:seed` / `db:seed:ssr` | シード投入 |
| `npm run db:studio` | Prisma Studio |
| `npm run typecheck` | 型チェック（`tsc --noEmit`）。型安全ゲート |
| `npm run test:e2e`（`:ui` / `:headed` / `:debug`） | Playwright E2E |
| `npm run icons` | PWA アイコン生成 |

---

## ドキュメント

- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — ディレクトリ構造・データモデル・状態管理の設計
- [AGENTS.md](AGENTS.md) — AI エージェント向けの開発ルール（Next.js 16 の破壊的変更に注意）
