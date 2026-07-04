# Chore Safari（チョア・サファリ）

**「現実のお手伝いと成長が、デジタルの冒険に繋がる。」**

家族の子供たちが遊ぶ、お手伝い連動型の知育＆どうぶつ捕獲 Web プラットフォーム。
現実のお手伝い・学習・生活習慣の達成で **コイン** を獲得し、そのコインで道具やアイテムを集め、
さまざまな時代・生息地の動物や恐竜を捕まえて、**家族共通の図鑑** を完成させていきます。

> このドキュメントは「どんなゲームか」を一通り理解するための入口です。
> ディレクトリ構造・データモデル・状態管理などの**実装の詳細**は [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) を参照してください。

---

## どんなゲーム？（30秒サマリ）

- **誰が**: 家庭内（兄妹）。3人の子供と親アカウントが前提の、クローズドな家族向けアプリ。
- **何をする**: 現実のお手伝い → コイン獲得 → 罠を手に入れる → **クイズに正解** → 動物を捕まえる → 図鑑を埋める、という一直線のループ。
- **一本道化（2026-06-12）**: 機能肥大化による「迷い」を解消するため、ワールドマップの表示ピンを**コアループの6つに絞った**（[docs/DESIGN_PRINCIPLES.md](docs/DESIGN_PRINCIPLES.md) 準拠）。農場・牧場・動物園・クラフト・レース・ゲームセンター等は**非表示**（コード・ページは残置・URL 直アクセスは可能）。
- **通貨は1種類**: ゲーム内の経済はすべて **コイン**。親がお手伝いを承認すると増え、罠の購入・クレーンゲームなどで減る。
- **データの正**: コイン・図鑑・在庫は **PostgreSQL（Prisma）が唯一の真実**。Zustand/localStorage は DB 値のミラー。図鑑は家族で共有され、どの子・どの端末からも同じ図鑑が見える。
- **AI 拡張**: クイズ生成と相棒キャラとの会話に **Google Gemini**、会話の音声に **VOICEVOX（ずんだもん）** を使用。
- **公開**: Cloudflare Tunnel 経由（`chore-safari.negoyou.com`）。インターネットには出すが、想定ユーザーは家族のみ。

### 登場人物

| 子供 | よみ | アバター | 親アカウント |
|---|---|---|---|
| 美琴 | みこと | 🦭 アザラシ | 親は **Bank（銀行）画面** でクエスト承認・ボーナス/ペナルティを管理する |
| 幸仁 | ゆきと | 🐹 ハムスター | （子供3人は同じ図鑑・経済を共有しつつ、コイン残高は個別） |
| 叶泰 | かなた | 🦦 カワウソ | |

---

## コアサイクル

子供は **ワールドマップ**（[WorldMapPortal](app/kids/WorldMapPortal.tsx)）を拠点に、アバターを歩かせて各施設を回ります。一本道化リフォーム（2026-06-12）により、表示されるピンは下記コアループの **6つ** に絞られています。

1. **お手伝いと銀行（Quest & Bank）**
   - 親が設定したクエストを子供が申請する。クエストは4カテゴリ：**おてつだい（CHORE）/ おべんきょう（STUDY）/ せいかつ（LIFE）/ うんぱん（LOGISTICS）**。
   - 親が **Bank 画面** で申請を承認するとコインが付与される（特大ボーナス付与・ペナルティ没収あり）。
   - 連続達成で報酬が増える **ストリーク**（[lib/streak.ts](lib/streak.ts)）を搭載。
   - クエスト申請は **1日10回まで**（[QUEST_DAILY_SUBMIT_LIMIT](app/kids/config.ts)）。

2. **うんぱんミッション（Logistics）**
   - 「現実のモノを運ぶ」お手伝い（LOGISTICS カテゴリ）の専用申請枠。承認するとコインに加えて **レア罠（cage_trap）が1個**付与される（[LOGISTICS_REWARD_TOOL_ID](lib/quest-categories.ts)）。
   - レア罠の唯一の入手経路＝現実の運搬を最高価値の行動に位置づけている。旧「エサ配送ミニゲーム」は廃止。

3. **罠の入手（コイン → 罠）**
   - サファリ画面でコイン **30枚**を払って基本の罠（おとしあな / [TRAP_COST・SHOP_TRAP_TOOL_ID](app/kids/config.ts)）を購入できる。
   - レア罠は上記うんぱんミッションの報酬で手に入る。**クラフト工房は非表示**（Zustand のトイ実装で DB の UserTool に未接続のため、罠の入手経路から外した）。

4. **クイズ → 狩りと図鑑（Safari & Dictionary）**
   - **罠を仕掛ける直前 / アクティブ狩りに出発する直前**に、全画面クイズ（[QuizGate](app/kids/[kidId]/QuizGate.tsx)）に正解しないと進めない（学びをゲーム進行の「鍵」に直結）。
   - **罠スタイル（パッシブ）**: 罠を仕掛けて待ち、出現した動物をタイミングゲームで捕獲。**設置は1日3回まで**（[TRAP_DAILY_LIMIT](app/kids/config.ts)）。
   - **アクティブ狩り**: 弓・槍を持ち、ゲージ式タイミングで動物を捕獲。**1日の捕獲回数に上限あり**（コイン報酬はなし＝図鑑の量産防止）。
   - 上限に達すると「きょうのぶんは おしまい」全画面（[DayEndScreen](app/kids/[kidId]/DayEndScreen.tsx)）で1日の終わりを明示する。
   - 捕まえた動物は **家族共通の博物図鑑** に記録される。

5. **自分の家と図鑑（House / Dictionary）**
   - **自分の家**: 捕まえた動物が待つハブ。観察・親密度上げ・AI 会話を行う。
   - **博物図鑑**: 家族共通の図鑑を閲覧し、図鑑クイズに挑戦できる。
   - **寿命と殿堂入り**: 動物には寿命があり、天寿を全うすると図鑑の記録に残る。

6. **AI による体験拡張（Gemini）**
   - **図鑑クイズ / クイズゲート**: 図鑑の動物解説などから Gemini が3択クイズを生成（Gemini→フォールバック→ローカル決め打ちの3段構え）。
   - **AI ガイドキャラクター**: 相棒の動物が性格（パーソナリティ）を持ち、親密度に応じて Gemini 経由で対話。
     応答は **VOICEVOX**（ずんだもん）でフルボイス再生される。

7. **おたがいさま（Kizuna Events）**
   - **ページを移動するたびに 5% の確率**で、こまっている人が画面中央に登場（ログイン時に限らない）。連続表示を防ぐ短いクールダウンあり。
   - **やさしい／ふつう／いじわる**の3択で答え、相手の顔（😊🙂😢）と反応が変化。
   - **やさしい**を選んだ時だけ「お返し」がたまり、後日 別のだれかが助けに来てくれる。

8. **演出（BGM / 天気）**
   - 画面ごとに自動で切り替わる BGM、ワールドマップの天気エフェクト（晴れ・くもり・雨・台風・猛暑）を搭載。

> **非表示の施設（コアループ外）**: 農場・牧場・動物園・クラフト工房・カオスレース・ゲームセンター（クレーン/早押しクイズ/スロット）・「ながれ」可視化ページは、一本道化により**ワールドマップから隠している**（[HIDDEN_PIN_IDS](app/kids/config.ts)）。コード・ページ自体は残置しており、ID を外せば復活できる。早押しクイズ・カオスレースはコインを獲得できる自己完結ループのため、現在はマップ動線から外れている。

---

## 主要施設（ワールドマップのピン）

ワールドマップのピンをタップするとアバターが歩いて移動し、施設へ遷移します。一本道化（2026-06-12）により、**表示中はコアループの6ピンのみ**です。

### 表示中（コアループの6ピン）

| 施設 | ルート | 役割 |
|---|---|---|
| クエストギルド | `quests` | お手伝い・クエストの申請（入口。LOGISTICS は除外表示） |
| うんぱんミッション | `logistics` | 現実のモノの運搬おてつだいを申請。承認でコイン＋レア罠 |
| 罠スタイル | `safari?style=passive` | 罠を仕掛けて待つパッシブ狩り（設置直前にクイズ必須・1日3回まで） |
| アクティブ狩り | `safari?style=active` | 弓・槍でゲージ式タイミング狩り（出発直前にクイズ必須・1日の回数制限あり） |
| 自分の家 | `house` | 捕獲動物のハブ・親密度・AI 会話 |
| 博物図鑑 | `dictionary` | 図鑑を閲覧＋図鑑クイズ |

### 非表示（[HIDDEN_PIN_IDS](app/kids/config.ts)。URL 直アクセスは可能）

| 施設 | ルート | 備考 |
|---|---|---|
| クラフト工房 | `craft` | Zustand トイ実装（DB の UserTool に未接続）。罠入手は「コイン購入＋うんぱん報酬」に移行 |
| 農場 / 牧場 / 動物園 | `farm` / `ranch` / `zoo` | 画面内で完結する作業系のため隠蔽 |
| カオスレース | `race` | 5レーンのベット式レース（実況はクライアント乱数・LLM 不使用） |
| ゲームセンター | （モーダル） | クレーン / 早押しクイズ / サファリスロット（準備中） |
| ながれ | `flow` | 一本道化により役割消滅 |

> 親向けの **Bank（銀行・マネジメント）画面**（`/bank`）は子供のワールドマップとは別系統で、クエスト承認・クエストマスタ管理・ボーナス/ペナルティ運用を行う。

---

## 図鑑と動物

- 図鑑は **家族共通**（DB の `CaughtAnimal` が唯一のソース）。誰が捕まえても同じ1冊に記録され、全端末・全機能（図鑑・レース・倉庫）に反映される。
- 動物は **実在の生き物中心** へ移行中。各動物は「総称（例: くま）」と「種名（例: ヒグマ）」を持つ。図鑑の拡充は非破壊シンク（`npm run db:animals`）で家族の進捗を消さずに追加できる（[prisma/animals-extra.ts](prisma/animals-extra.ts)）。
- 動物には **生息地ステージ（savanna / forest / ice_age / deep_sea / cretaceous など）** と **時代（era）/ 生息地（location）**、**レアリティ（COMMON / RARE / EPIC / LEGENDARY）**、**寿命（lifespanYears）** が設定される。
- 捕まえた個体は **親密度（intimacyScore）** と **性格（personalityId）** を持ち、AI ガイドとして会話できる。寿命を迎えると殿堂入りとして記録に残る。

---

## 技術スタック

| 区分 | 採用技術 |
|---|---|
| Frontend / Backend | **Next.js 16**（App Router, Server Actions, Route Handlers）, React 19, TypeScript |
| スタイル / 演出 | Tailwind CSS v4, Framer Motion, canvas-confetti, lucide-react |
| 状態管理 | Zustand v5（`persist`／localStorage・DB のミラー）, React Server Components |
| データベース | PostgreSQL 16 + Prisma 6 |
| LLM | **Google Gemini**（Vercel AI SDK `@ai-sdk/google` + `ai`） |
| 音声合成（TTS） | **VOICEVOX**（FastAPI ブリッジ経由・話者は既定でずんだもん） |
| テスト | Playwright（E2E） |
| インフラ | Docker Compose（web / web-prod / db / VOICEVOX / FastAPI / Cloudflare Tunnel） |

> ⚠️ AI は以前 Ollama を使用していましたが、現在は **Gemini に全面移行済み**で、Ollama 依存はコードから完全に削除されています。
>
> ⚠️ `AGENTS.md` の通り、この Next.js 16 は学習データと異なる破壊的変更を含みます。コードを書く前に `node_modules/next/dist/docs/` の該当ガイドを参照してください。

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

> **Note**: クイズ・AI ガイド対話には `GEMINI_API_KEY` が必須です。AI 会話の音声再生には VOICEVOX（`voicevox_engine` + `backend`）が必要です。
> いずれも未設定／停止時は該当機能がエラーまたは無音になります（コア機能のお手伝い・狩り・図鑑は動作します）。
> カオスレースは LLM を使わないため、`GEMINI_API_KEY` 無しでも遊べます。

---

## 環境変数

`.env`（gitignore 済み）に設定します。`docker-compose.yml` の `environment` で上書きされる項目もあります。

| 変数 | 用途 | 例 / 既定 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 接続文字列 | `postgresql://chore:chore@localhost:5433/chore_safari?schema=public` |
| `GEMINI_API_KEY` | Google AI Studio の API キー（クイズ・AI 会話に**必須**） | — |
| `GEMINI_MODEL` | 使用モデルを**固定したい時だけ**指定（任意） | 未指定なら `gemini-flash-latest`（常に最新の安定 flash）。既定は [lib/gemini.ts](lib/gemini.ts) に集約 |
| `BACKEND_URL` | FastAPI TTS ブリッジの URL | `http://backend:8000` |
| `VOICEVOX_SPEAKER_ID` | VOICEVOX の話者 ID（`backend` で使用） | `3`（ずんだもん） |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel 用トークン | — |

---

## npm スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` / `start` | 本番ビルド / 起動 |
| `npm run lint` | ESLint |
| `npm run typecheck` | 型チェック（`tsc --noEmit`）。型安全ゲート |
| `npm run db:up` / `db:down` | Docker Compose 起動 / 停止 |
| `npm run db:migrate` / `db:reset` | マイグレーション適用 / リセット |
| `npm run db:seed` / `db:seed:ssr` | シード投入（破壊的・進捗をリセット） |
| `npm run db:animals` | 動物マスタの**非破壊**シンク（家族の進捗を消さず図鑑だけ更新） |
| `npm run db:studio` | Prisma Studio |
| `npm run test:e2e`（`:ui` / `:headed` / `:debug`） | Playwright E2E |
| `npm run icons` | PWA アイコン生成 |

---

## ドキュメント

- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — ディレクトリ構造・データモデル・状態管理・AI/音声連携・既知の技術的負債（**実装の詳細リファレンス**）
- [AGENTS.md](AGENTS.md) — AI エージェント向けの開発ルール（Next.js 16 の破壊的変更に注意）
