# Chore Safari - プロジェクト構造ガイド

**作成日**: 2026-05-22
**プロジェクト**: Chore Safari（チョア・サファリ）  
**言語**: TypeScript / React + Next.js 16 + PostgreSQL

---

## 📋 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [ディレクトリ構造図](#ディレクトリ構造図)
3. [主要ディレクトリ解説](#主要ディレクトリ解説)
4. [データモデル一覧](#データモデル一覧)
5. [ページ・ルーティング一覧](#ページルーティング一覧)
6. [技術スタック](#技術スタック)

---

## プロジェクト概要

### コンセプト
家族の子供たちが現実世界の「お手伝い」や「テスト点数」をゲーム内コインで報酬化され、そのコインを使ってクレーンゲームで素材を獲得し、クラフトで道具を作り、森で動物を捕まえて「家族共通の図鑑」を完成させるプラットフォーム。

### コア機能（3C）
1. **Quest & Bank（経済基盤）** - クエスト設定、コイン残高管理、報酬付与、ペナルティ没収
2. **Crane & Craft（準備と在庫）** - 家族共有インベントリ、素材ドロップ（クレーン）、アイテム合成（クラフト）
3. **Hunt & Safari（メインゲーム）** - 動物捕獲（パッシブ罠・アクティブ狩り）、競争レース、動物クイズ

### 最新改修（2026-05-22現在）
- **全フェーズ（Phase 1〜4）実装完了**：銀行機能、クレーン、クラフト、サファリ、LLM連携レースなど一通りが稼働。
- **Hunt/Toolシステムの拡張**：`WEAPON`（刃物・銃器など）の追加。
- **Ollama連携の拡充**：読解力クイズに加え、30秒カオスレースの実況シナリオ生成をOllamaで実装。

---

## ディレクトリ構造図

```
chore-safari/
├── app/                          # Next.js App Router（ページ・API）
│   ├── api/                      # API エンドポイント
│   │   ├── alexa/
│   │   ├── manifest/
│   │   ├── quiz/generate/        # Ollama クイズ自動生成
│   │   └── race/                 # レース API
│   │       └── generate/         # Ollama レース実況生成
│   ├── bank/                     # 親用銀行管理ポータル
│   │   ├── dev/                  # 開発用デバッグページ
│   │   ├── penalties/            # ペナルティマスター
│   │   ├── quests/               # クエストマスター
│   │   └── page.tsx              # メインページ
│   ├── kids/                     # 子供用ポータルハブ
│   │   ├── [kidId]/              # 個別子供エリア（ワールドマップハブ）
│   │   │   ├── craft/            # クラフト（アイテム合成）
│   │   │   ├── crane/            # クレーンゲーム（素材獲得）
│   │   │   ├── dictionary/       # 動物図鑑
│   │   │   ├── guild/            # クエストギルド（クエスト集約ポイント）
│   │   │   ├── race/             # 動物レース
│   │   │   ├── safari/           # サファリ（狩り/ハント）
│   │   │   │   └── hunt/         # アクティブ狩り（ゲージ式タイミング）
│   │   │   └── warehouse/        # 博物倉庫（図鑑+インベントリ+道具）
│   │   ├── craft/                # (レガシー) 共有クラフト
│   │   ├── crane/                # (レガシー) 共有クレーンゲーム
│   │   ├── quests/               # (レガシー) クエスト一覧
│   │   ├── race/                 # (レガシー) レース一覧
│   │   └── safari/               # (レガシー) サファリ
│   ├── layout.tsx                # ルートレイアウト
│   ├── globals.css               # グローバルスタイル
│   └── page.tsx                  # ホームページ
├── lib/                          # ユーティリティ・ロジック
│   ├── age.ts                    # 生年月日 → 年齢計算
│   ├── prisma.ts                 # Prisma クライアント初期化
│   ├── ollama.ts                 # Ollama API 統合クライアント
│   ├── recipes.ts                # クラフトレシピ定義（BOM）
│   └── quest-categories.ts       # クエスト分類メタデータ
├── prisma/                       # データベース定義
│   ├── schema.prisma             # Prisma スキーマ
│   ├── migrations/               # DB マイグレーション履歴
│   ├── seed.ts                   # メインシードデータ
│   └── seed-ssr.ts               # SSR 用シードデータ
├── scripts/                      # 開発・テスト用スクリプト
│   ├── generate-icons.mjs        # アイコン SVG 生成
│   ├── reset-coins.ts            # コイン残高リセット（保全版）
│   ├── reset-coins-hard.ts       # コイン残高リセット（全削除版）
│   ├── reset-dictionary.ts       # 図鑑データ全削除
│   └── ...
├── public/                       # 静的資産
├── node_modules/                 # npm 依存
├── package.json                  # npm スクリプト・依存定義
├── tsconfig.json                 # TypeScript 設定
├── next.config.ts                # Next.js 設定
├── docker-compose.yml            # PostgreSQL ローカル環境
├── Dockerfile.dev / .prod        # コンテナイメージ定義
├── .env                          # 環境変数（DB_URL、Ollama host など）
├── .gitignore                    # Git 無視ファイル
├── eslint.config.mjs             # ESLint 設定
├── CLAUDE.md                     # @AGENTS.md への参照
├── AGENTS.md                     # 次世代 Next.js の警告
└── README.md                     # プロジェクト概要
```

---

## 主要ディレクトリ解説

### 1️⃣ `app/api/` - API エンドポイント層

**役割**: サーバーサイド API ロジック（Next.js Route Handlers）

| ファイル/ディレクトリ | 役割 | 入力 | 出力 | 備考 |
|---|---|---|---|---|
| `api/manifest/route.ts` | PWA マニフェスト配信 | - | JSON（アプリメタ） | Next.js favicon 補助 |
| `api/alexa/route.ts` | Alexa スキル連携 | Alexa リクエスト | JSON | 親スマホでの声操作統合予定 |
| `api/quiz/generate/route.ts` | 動物クイズ自動生成 | animalId, description | 3択クイズ JSON | Ollama 呼び出し |
| `api/race/generate/route.ts` | レース実況文自動生成 | 参加者名 | 実況テキスト JSON | Ollama 呼び出し |

---

### 2️⃣ `app/bank/` - 親用銀行・マネジメントポータル

**役割**: 親が子供の成長を管理する管理画面

| ファイル/ディレクトリ | 役割 | ページ URL | 機能 |
|---|---|---|---|
| `page.tsx` | メイン銀行画面 | `/bank` | コイン残高、子供一覧、クイック報酬付与 |
| `quests/` | クエストマスター | `/bank/quests` | クエスト定義・審査の一元管理 |
| `penalties/` | ペナルティマスター | `/bank/penalties` | ペナルティルール定義・実行 |
| `dev/` | 開発用デバッグ画面 | `/bank/dev` | DB 直接操作、データリセット |
| `actions.ts` | サーバーアクション | - | `"use server"` - 報酬・没収・審査ロジック |

---

### 3️⃣ `app/kids/` - 子供用ポータル

**役割**: 子供たちが遊ぶゲーム・クエスト・図鑑ハブ

#### 3-1. ハブ構造（`/kids` + `/kids/[kidId]`）

| ファイル | 役割 | ページ URL | 説明 |
|---|---|---|---|
| `page.tsx` | 子供選択画面 | `/kids` | 「誰で遊ぶ？」3人の子供から選択 |
| `[kidId]/page.tsx` | **ワールドマップハブ** | `/kids/:kidId` | 各種機能へのハブ |

#### 3-2. ギルド（クエスト集約）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/guild/page.tsx` | ギルド入口 | `/kids/:kidId/guild` | クエスト・スタミナ・進捗の統合表示 |

#### 3-3. サファリ（動物捕獲）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/safari/page.tsx` | サファリハブ | `/kids/:kidId/safari` | ステージ選択 |
| `[kidId]/safari/hunt/page.tsx` | 狩り開始 | `/kids/:kidId/safari/hunt` | Hunt 条件選択（Stage/Tool/Bait） |

#### 3-4. クラフト（アイテム合成）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/craft/page.tsx` | クラフト入口 | `/kids/:kidId/craft` | レシピ一覧表示 |

#### 3-5. クレーンゲーム（素材獲得）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/crane/page.tsx` | クレーン入口 | `/kids/:kidId/crane` | コインを消費して素材を入手 |

#### 3-6. 動物図鑑

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/dictionary/page.tsx` | 図鑑一覧 | `/kids/:kidId/dictionary` | 捕まえた動物のみ表示 |

#### 3-7. レース（競争）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/race/page.tsx` | レース選択 | `/kids/:kidId/race` | Ollamaによる実況付きレース |

#### 3-8. 倉庫（統合管理）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/warehouse/page.tsx` | 倉庫入口 | `/kids/:kidId/warehouse` | インベントリ＋図鑑＋道具の統合表示 |

---

### 4️⃣ `lib/` - コア ユーティリティ・ロジック

**役割**: 再利用可能なビジネスロジックと共有定数

| ファイル | 役割 | 主要 export |
|---|---|---|
| `age.ts` | 年齢計算 | `calculateAge(birthDate)` |
| `prisma.ts` | DB クライアント | Prisma シングルトン初期化 |
| `ollama.ts` | LLM 通信クライアント| `ollamaChat()` |
| `recipes.ts` | クラフトレシピ | `RECIPES[]` |
| `quest-categories.ts` | クエスト分類 | `QUEST_CATEGORIES` |

---

### 5️⃣ `prisma/` - データベース定義・マイグレーション

#### エンム（列挙型）一覧

| エンム名 | 値 | 用途 |
|---|---|---|
| `UserRole` | CHILD, PARENT | ユーザータイプ区別 |
| `CoinTxKind` | CHORE, PENALTY, BONUS, GACHA, ADJUSTMENT | 取引分類 |
| `ItemType` | FOOD, TRAP_PART, MATERIAL | インベントリアイテム分類 |
| `HuntType` | TRAP, BOW, SPEAR, WEAPON | 狩り方式（道具種別） |
| `ToolType` | TRAP, BOW, SPEAR, WEAPON | 道具種別（HuntType と同期） |
| `HuntStatus` | PLACED, APPEARED, CAUGHT, ESCAPED | 狩り・罠のライフサイクル |

---

## 技術スタック

### フロントエンド
- **Next.js 16** (App Router)
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**
- **Framer Motion 11**

### バックエンド
- **Next.js API Routes / Server Actions**
- **Prisma 6.2**
- **PostgreSQL** (Docker Compose)

### AI・LLM
- **Ollama** - ローカル LLM（クイズ自動生成・レース実況生成）。JSON出力に対応。

---

## 開発ワークフロー

### セットアップ

```bash
# パッケージインストール
npm install

# 環境変数設定 (必要に応じて)
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/chore_safari" > .env

# DB 起動
npm run db:up
npm run db:migrate
npm run db:seed

# 開発サーバー起動
npm run dev
```

---

## 次のステップ

### 今後の拡張アイデア

1. **コンテンツ追加**: 新しい動物や生息地ステージ（深海、氷河期など）の追加
2. **UI/UX向上**: アニメーション（Framer Motion）のさらなる拡充
3. **ゲームバランス**: 捕獲確率計算やクラフトレシピのバランス調整
4. **エコシステム拡張**: 動物の寿命システムの高度化

---

**作成者**: Claude / Gemini
**最終更新**: 2026-05-22
