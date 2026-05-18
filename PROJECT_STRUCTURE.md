# Chore Safari - プロジェクト構造ガイド

**作成日**: 2026-05-18  
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
家族3人の子供たちが現実世界の「お手伝い」や「テスト点数」をゲーム内コインで報酬化され、そのコインを使ってクレーンゲームで罠や餌を獲得し、森で動物を捕まえて「家族共通の図鑑」を完成させるプラットフォーム。

### コア機能（3C）
1. **Coin & Bank（経済基盤）** - コイン残高管理、報酬付与、ペナルティ没収
2. **Crane & Craft（準備と在庫）** - 家族共有インベントリ、クラフト、ガチャ
3. **Catch & Compete（メインゲーム）** - 動物捕獲（Hunt）、競争レース

### 最新改修（2026-05-17）
- **ActiveTrap → Hunt** にリネーム（DB マイグレーション完了）
- **Stage/Tool モデル**新設（6ステージ、7種類の道具）
- **ワールドマップハブ化**：`/kids/[kidId]`が中心。ギルド→サファリ→倉庫の3拠点に分化
- **スタミナシステム**：アクティブ狩り(BOW/SPEAR)は1日3回制限
- **Ollama読解クイズ**：動物説明文から自動生成される3択クイズ

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
│   ├── bank/                     # 親用銀行管理ポータル
│   │   ├── dev/                  # 開発用デバッグページ
│   │   ├── penalties/            # ペナルティマスター
│   │   ├── quests/               # クエストマスター
│   │   └── page.tsx              # メインページ
│   ├── kids/                     # 子供用ポータルハブ
│   │   ├── [kidId]/              # 個別子供エリア（ワールドマップハブ）
│   │   │   ├── craft/            # クラフト（アイテム合成）
│   │   │   ├── crane/            # クレーンゲーム（ガチャ）
│   │   │   ├── dictionary/       # 動物図鑑
│   │   │   ├── guild/            # クエストギルド（クエスト集約ポイント）
│   │   │   ├── race/             # 動物レース
│   │   │   ├── safari/           # サファリ（狩り/ハント）
│   │   │   │   └── hunt/         # アクティブ狩り（ゲージ式タイミング）
│   │   │   └── warehouse/        # 博物倉庫（図鑑+インベントリ+道具）
│   │   ├── craft/                # 共有クラフト
│   │   ├── crane/                # 共有クレーンゲーム（レガシー）
│   │   ├── quests/               # クエスト一覧（レガシー）
│   │   ├── race/                 # レース一覧（レガシー）
│   │   └── safari/               # サファリ（レガシー）
│   ├── layout.tsx                # ルートレイアウト
│   ├── globals.css               # グローバルスタイル
│   └── page.tsx                  # ホームページ
├── lib/                          # ユーティリティ・ロジック
│   ├── age.ts                    # 生年月日 → 年齢計算
│   ├── prisma.ts                 # Prisma クライアント初期化
│   ├── ollama.ts                 # Ollama API 統合
│   ├── recipes.ts                # クラフトレシピ定義（BOM）
│   └── quest-categories.ts       # クエスト分類メタデータ
├── prisma/                       # データベース定義
│   ├── schema.prisma             # Prisma スキーマ（14モデル）
│   ├── migrations/               # DB マイグレーション履歴
│   ├── seed.ts                   # メインシードデータ（100+ 動物、6ステージ）
│   └── seed-ssr.ts              # SSR 用シードデータ（軽量版）
├── scripts/                      # 開発・テスト用スクリプト
│   ├── generate-icons.mjs        # アイコン SVG 生成
│   ├── reset-coins.ts            # コイン残高リセット（保全版）
│   ├── reset-coins-hard.ts       # コイン残高リセット（全削除版）
│   ├── reset-dictionary.ts       # 図鑑データ全削除
│   ├── test-gemini.mjs           # Google Gemini テスト
│   └── test-race-api.mjs         # レース API テスト
├── public/                       # 静的資産
│   └── (SVG・PNG・その他)
├── node_modules/                 # npm 依存
├── package.json                  # npm スクリプト・依存定義
├── tsconfig.json                 # TypeScript 設定
├── next.config.ts                # Next.js 設定
├── docker-compose.yml            # PostgreSQL ローカル環境
├── Dockerfile.dev / .prod        # コンテナイメージ定義
├── .env                          # 環境変数（DB_URL、Ollama host など）
├── .gitignore                    # Git 無視ファイル
├── .eslintrc                     # ESLint 設定
├── CLAUDE.md                     # @AGENTS.md への参照
├── AGENTS.md                     # 次世代 Next.js の警告
└── README.md                     # プロジェクト概要

コード行数: app/ ~15,400 行、prisma/ ~395 行（schema）、lib/ 保守的設計
```

---

## 主要ディレクトリ解説

### 1️⃣ `app/api/` - API エンドポイント層

**役割**: サーバーサイド API ロジック（Next.js Route Handlers）

| ファイル/ディレクトリ | 役割 | 入力 | 出力 | 備考 |
|---|---|---|---|---|
| `api/manifest/route.ts` | PWA マニフェスト配信 | - | JSON（アプリメタ） | Next.js favicon 補助 |
| `api/alexa/route.ts` | Alexa スキル連携 | Alexa リクエスト | JSON | 親スマホでの声操作統合予定 |
| `api/quiz/generate/route.ts` | 動物クイズ自動生成 | animalId, retries | 3択クイズ JSON | Ollama/Gemini API 呼び出し |
| `api/race/route.ts` | レース実況・進捗 API | raceId, kidId | JSON（ラップタイム等） | WebSocket 統合予定 |
| `api/race/generate/route.ts` | レース実況文自動生成 | 動物データ | 実況テキスト | Gemini/Ollama 連携 |

**キー実装パターン**:
- `lib/prisma.ts` で `PrismaClient` 取得
- `lib/ollama.ts` で LLM 読解クイズ生成
- Server Action との差分：API は外部統合向け、Server Action は UI フロー向け

---

### 2️⃣ `app/bank/` - 親用銀行・マネジメントポータル

**役割**: 親が子供の成長を管理する管理画面

| ファイル/ディレクトリ | 役割 | ページ URL | 機能 |
|---|---|---|---|
| `page.tsx` | メイン銀行画面 | `/bank` | コイン残高、子供一覧、クイック報酬付与 |
| `BankPortal.tsx` | バナー・ナビ | - | 親ポータルのシェルコンポーネント |
| `ChoreButton.tsx` | お手伝いアイコンボタン | - | 短押し/長押し区別で報酬・ペナルティ付与 |
| `BonusPanel.tsx` | 特大ボーナス付与パネル | - | 複数子供への一括報酬 |
| `PenaltyPanel.tsx` | ペナルティ付与パネル | - | ルール違反時の没収 UI |
| `QuestReviewPanel.tsx` | クエスト審査パネル | - | 親が子供申請を APPROVED/REJECTED |
| `quests/` | クエストマスター | `/bank/quests` | クエスト定義・審査の一元管理 |
| `quests/QuestMasterClient.tsx` | クエスト一覧・CRUD | - | CHORE/STUDY/LIFE カテゴリ別表示 |
| `penalties/` | ペナルティマスター | `/bank/penalties` | ペナルティルール定義・実行 |
| `penalties/PenaltyMasterClient.tsx` | ペナルティ一覧・CRUD | - | システムペナルティ vs カスタムペナルティ |
| `dev/` | 開発用デバッグ画面 | `/bank/dev` | DB 直接操作、データリセット |
| `actions.ts` | サーバーアクション | - | `"use server"` - 報酬・没収・審査ロジック |

**データフロー例**（親が子供にお手伝い報酬）:
1. 親が `/bank` で「ChoreButton」を長押し
2. `BonusPanel` で報酬額選択
3. `actions.ts` の `approveQuest()` → Prisma で `CoinTransaction` 作成
4. 子供の `User.coinBalance` 更新

---

### 3️⃣ `app/kids/` - 子供用ポータル

**役割**: 子供たちが遊ぶゲーム・クエスト・図鑑ハブ

#### 3-1. ハブ構造（`/kids` + `/kids/[kidId]`）

| ファイル | 役割 | ページ URL | 説明 |
|---|---|---|---|
| `page.tsx` | 子供選択画面 | `/kids` | 「誰で遊ぶ？」3人の子供から選択 |
| `[kidId]/page.tsx` | **ワールドマップハブ** | `/kids/:kidId` | ギルド/サファリ/倉庫への3拠点ハブ |
| `KidsPortal.tsx` | ハブバナー・ナビ | - | 子供ポータルのシェルコンポーネント |
| `config.ts` | 子供メタデータ | - | 固定の 3 子供データ（美琴・幸仁・叶泰） |

#### 3-2. ギルド（クエスト集約）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/guild/page.tsx` | ギルド入口 | `/kids/:kidId/guild` | クエスト・スタミナ・進捗の統合表示 |

#### 3-3. サファリ（動物捕獲）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/safari/page.tsx` | サファリハブ | `/kids/:kidId/safari` | ステージ選択 |
| `[kidId]/safari/SafariClient.tsx` | ステージマップ表示 | - | 6 ステージのビジュアルマップ |
| `[kidId]/safari/hunt/page.tsx` | アクティブ狩り開始 | `/kids/:kidId/safari/hunt` | Hunt 条件選択（Stage/Tool/Bait） |
| `[kidId]/safari/hunt/HuntClient.tsx` | 狩りゲームUI | - | ゲージ式タイミング＆クイズ実行 |

**狩りの流れ**:
1. ステージ選択（6種）
2. 道具選択（罠/弓/槍 × 複数）
3. 餌選択（食材インベントリから）
4. 仕掛け完了（`Hunt.status = PLACED`）
5. 動物出現条件を満たしたら `Hunt.status = APPEARED`
6. ゲージ式タイミング or クイズ実行
7. 成功時 `CaughtAnimal` 作成＆図鑑追加

#### 3-4. クラフト（アイテム合成）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/craft/page.tsx` | クラフト入口 | `/kids/:kidId/craft` | レシピ一覧表示 |
| `[kidId]/craft/CraftClient.tsx` | クラフト実行UI | - | 素材確認 → 合成ボタン |

**レシピ定義**: `lib/recipes.ts` に BOM（Bill of Materials）を集約  
例: `sturdy_trap` = 木板×2 + ロープ×1 → 仕掛けワナ

#### 3-5. クレーンゲーム（ガチャ）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/crane/page.tsx` | クレーン入口 | `/kids/:kidId/crane` | 難易度選択 |
| `[kidId]/crane/CraneClient.tsx` | ゲーム画面 | - | Phaser.js 統合予定、現在はモック |

**ガチャ確率**: `GachaTransaction` で履歴追跡

#### 3-6. 動物図鑑

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/dictionary/page.tsx` | 図鑑一覧 | `/kids/:kidId/dictionary` | 捕まえた動物のみ表示 |
| `[kidId]/dictionary/DictionaryClient.tsx` | 図鑑詳細 | - | 動物説明＆ステータス表示 |

**表示内容**: `Animal` の生年月日・生息地・説明文 + `CaughtAnimal` の捕獲日時

#### 3-7. レース（競争）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/race/page.tsx` | レース選択 | `/kids/:kidId/race` | 対戦相手・動物選択 |
| `[kidId]/race/RaceClient.tsx` | レースUI | - | 動物のラップタイム競い合い |
| `[kidId]/race/RacePlayer.tsx` | レーサー個別表示 | - | 1 匹の動物進捗バーコンポーネント |

#### 3-8. 倉庫（統合管理）

| ファイル | 役割 | URL | 機能 |
|---|---|---|---|
| `[kidId]/warehouse/page.tsx` | 倉庫入口 | `/kids/:kidId/warehouse` | インベントリ＋図鑑＋道具の統合表示 |

**統合表示**:
- `SharedInventoryItem`: 家族共有食材・素材
- `CaughtAnimal`: 図鑑（捕獲済み）
- `Tool`: 所有道具＆歴史的背景

#### 3-9. レガシー/共有ページ

| ファイル | 役割 | URL | 説明 |
|---|---|---|---|
| `craft/`, `crane/`, `quests/`, `race/`, `safari/` | 古い共有ページ | `/kids/*` | リファクタリング対象（`[kidId]` 配下に統合済み） |

---

### 4️⃣ `lib/` - コア ユーティリティ・ロジック

**役割**: 再利用可能なビジネスロジックと共有定数

| ファイル | 役割 | 主要 export |
|---|---|---|
| `age.ts` | 年齢計算 | `calculateAge(birthDate)`, `formatBirthDate()` |
| `prisma.ts` | DB クライアント | Prisma シングルトン初期化 |
| `ollama.ts` | LLM クイズ生成 | `generateQuizFromAnimal()` - Ollama/Gemini 連携 |
| `recipes.ts` | クラフトレシピ | `RECIPES[]` 配列 + 型定義（BOM） |
| `quest-categories.ts` | クエスト分類 | `QUEST_CATEGORIES`, `normalizeCategory()` |

**使用パターン**:
- Server Component 側: `lib/` から直接 import
- Client Component 側: API Route 経由 or `"use server"` ラッパー
- Prisma: `const prisma = require('@/lib/prisma').default`

---

### 5️⃣ `prisma/` - データベース定義・マイグレーション

**役割**: スキーマ定義・DB マイグレーション・初期データ

#### schema.prisma（14 モデル）

| モデル | 役割 | 主要フィールド |
|---|---|---|
| `User` | 子供・親 | id, name, birthDate, role(CHILD\|PARENT), coinBalance, dailyHuntCount |
| `CoinTransaction` | 取引履歴 | userId, amount, kind(CHORE\|STUDY\|PENALTY\|BONUS\|GACHA), timestamp |
| `SharedInventoryItem` | 家族共有在庫 | itemId, itemName, type(FOOD\|TRAP_PART), quantity |
| `GachaTransaction` | ガチャ履歴 | userId, gachaType, reward(Animal\|Item), timestamp |
| `Stage` | サバンナ等のエリア | id, name, emoji, description, historicalPeriod |
| `Tool` | 罠・弓・槍等の道具 | id, name, toolType(TRAP\|BOW\|SPEAR), rarity, historicalContext |
| `Animal` | 動物マスター | id, name, emoji, habitat, stageId, description, isExtinct |
| `CaughtAnimal` | 捕まえた動物記録 | userId, animalId, caughtAt, notesFromParent |
| `SpecialBonusNotification` | イベント通知 | userId, message, emoji, expiresAt |
| `Quest` | クエスト定義 | id, title, category(CHORE\|STUDY\|LIFE), coinReward |
| `QuestSubmission` | 子供の申請・承認 | userId, questId, submittedAt, status(PENDING\|APPROVED\|REJECTED) |
| `Hunt` | 狩り/罠レコード | userId, animalId, huntType(TRAP\|BOW\|SPEAR), status(PLACED\|APPEARED\|CAUGHT\|ESCAPED), toolId |
| `Penalty` | ペナルティルール | id, name, coinPenalty, description |
| `AnimalQuizCache` | クイズキャッシュ | animalId, quiz (JSON), generatedAt | 

#### マイグレーション履歴

- `20260517010000_safari_overhaul`: Hunt リネーム、Stage/Tool モデル追加
- `20260517020000_daily_hunt_stamina`: dailyHuntCount, lastHuntDate 追加

#### シードデータ

| ファイル | 内容 | 規模 |
|---|---|---|
| `seed.ts` | メインシード（開発用） | ~100 動物、6 ステージ、7 道具、5 サンプルユーザー |
| `seed-ssr.ts` | SSR 用軽量シード | 最小限のテストデータ |

---

### 6️⃣ `scripts/` - 開発・管理スクリプト

**役割**: データリセット・テスト・資産生成

| ファイル | 用途 | 実行例 |
|---|---|---|
| `generate-icons.mjs` | SVG アイコン自動生成 | `npm run icons` |
| `reset-coins.ts` | コイン残高リセット（保全） | `tsx scripts/reset-coins.ts` |
| `reset-coins-hard.ts` | 全交易削除（デバッグ用） | `tsx scripts/reset-coins-hard.ts` |
| `reset-dictionary.ts` | 図鑑・捕獲記録削除 | `tsx scripts/reset-dictionary.ts` |
| `test-gemini.mjs` | Gemini API テスト | `node scripts/test-gemini.mjs` |
| `test-race-api.mjs` | レース API テスト | `node scripts/test-race-api.mjs` |

---

## データモデル一覧

### 階層図（依存関係）

```
User (中心)
├─ CoinTransaction (取引履歴)
├─ QuestSubmission (クエスト申請)
│  └─ Quest (クエスト定義)
├─ CaughtAnimal (図鑑記録)
│  └─ Animal (動物マスター)
│     └─ Stage (生息地/時代)
├─ Hunt (狩り/罠)
│  ├─ Animal
│  └─ Tool (道具)
├─ GachaTransaction (ガチャ)
├─ SpecialBonusNotification (通知)
└─ Guild (予定)

共有テーブル
├─ SharedInventoryItem (家族共有在庫)
├─ Penalty (ペナルティルール)
└─ AnimalQuizCache (クイズキャッシュ)
```

### エンム（列挙型）一覧

| エンム名 | 値 | 用途 |
|---|---|---|
| `UserRole` | CHILD, PARENT | ユーザータイプ区別 |
| `CoinTxKind` | CHORE, STUDY, PENALTY, BONUS, GACHA, ADJUSTMENT | 取引分類 |
| `ItemType` | FOOD, TRAP_PART | インベントリアイテム分類 |
| `Rarity` | COMMON, RARE, EPIC, LEGENDARY | アイテム・動物のレア度 |
| `QuestStatus` | PENDING, APPROVED, REJECTED | 申請審査ステータス |
| `HuntType` | TRAP, BOW, SPEAR | 狩り方式（道具種別） |
| `ToolType` | TRAP, BOW, SPEAR | 道具種別（HuntType と同期） |
| `HuntStatus` | PLACED, APPEARED, CAUGHT, ESCAPED | 狩り・罠のライフサイクル |

---

## ページ・ルーティング一覧

### 親用（Bank）

```
/bank                     親銀行メイン
├─ /bank/quests          クエストマスター
├─ /bank/penalties       ペナルティマスター
└─ /bank/dev             開発用デバッグ画面
```

### 子供用（Kids）

```
/kids                     子供選択画面（誰で遊ぶ？）
└─ /kids/:kidId          ワールドマップハブ（中心）
   ├─ /safari            サファリハブ
   │  └─ /hunt           アクティブ狩り
   ├─ /guild             クエストギルド
   ├─ /craft             クラフト
   ├─ /crane             クレーンゲーム
   ├─ /race              レース
   ├─ /dictionary        動物図鑑
   └─ /warehouse         博物倉庫（統合）
```

### API

```
/api/manifest            PWA マニフェスト
/api/alexa               Alexa スキル連携
/api/quiz/generate       クイズ自動生成
/api/race                レース API
/api/race/generate       実況生成
```

---

## 技術スタック

### フロントエンド

- **Next.js 16** (App Router) - サーバーコンポーネント・Server Action 駆動
- **React 19.2** - UI コンポーネント
- **TypeScript 5** - 型安全性
- **Tailwind CSS 4** - スタイリング
- **Framer Motion 11** - アニメーション
- **Canvas Confetti** - 演出（お祝い）

### バックエンド

- **Next.js API Routes** - サーバーレス API
- **Server Actions** (`"use server"`) - フォーム送信・DB 更新
- **Prisma 6.2** - ORM（型安全）

### データベース

- **PostgreSQL** - RDBMS
- **Docker Compose** - ローカル開発環境
- **Prisma Client** - ORM クライアント
- **Prisma Studio** - DB 管理 UI

### AI・LLM

- **@ai-sdk/google** - Google Gemini 統合（将来用）
- **Ollama** - ローカル LLM（読解クイズ生成）

### 開発・テスト

- **tsx** - TypeScript 実行環境
- **ESLint 9** - 静的解析
- **@resvg/resvg-js** - SVG レンダリング

### 環境管理

- **.env** - 環境変数
  - `DATABASE_URL`: PostgreSQL 接続文字列
  - `OLLAMA_HOST`: Ollama API ホスト
  - `OLLAMA_MODEL`: LLM モデル（デフォルト `llama3.2`）
  - `OLLAMA_TIMEOUT_MS`: タイムアウト（デフォルト 25000）

---

## 開発ワークフロー

### セットアップ

```bash
# 環境変数設定
echo "DATABASE_URL=postgresql://user:pass@localhost/chore_safari" > .env

# DB 起動
npm run db:up

# マイグレーション
npm run db:migrate

# シードデータ投入
npm run db:seed

# 開発サーバー起動
npm run dev
```

### ホットリロード

- Server Component: ブラウザ自動リロード
- Client Component: 高速リフレッシュ
- API Route: ホットリロード

### デバッグ

- **Prisma Studio**: `npm run db:studio` → http://localhost:5555
- **Dev ページ**: `/bank/dev` → コイン直接操作・データリセット
- **ブラウザ DevTools**: Next.js App Router パネル搭載

### デプロイ

```bash
# ビルド
npm run build

# 本番起動
npm run start

# Docker 化
docker build -f Dockerfile.prod -t chore-safari:latest .
docker push ...
```

---

## 主要設定ファイル

| ファイル | 役割 |
|---|---|
| `tsconfig.json` | TypeScript の厳密性設定 |
| `next.config.ts` | Next.js の実験的機能・ヘッダー |
| `tailwind.config.*` | Tailwind CSS カスタマイズ |
| `eslint.config.mjs` | ESLint ルール |
| `docker-compose.yml` | PostgreSQL + Adminer 起動設定 |

---

## コード量・規模感

```
app/         : ~15,400 行（主要ロジック）
prisma/      : ~395 行（schema）+ マイグレーション
lib/         : ~300 行（ユーティリティ）
scripts/     : 補助スクリプト
public/      : 静的資産
```

**全体**: ~18,000 行の TypeScript/JavaScript

---

## よくある質問（FAQ）

### Q: 新しいページを追加する場合、どこに作成する？

**A**: 以下の優先順位で判定：

1. **子供専用ゲーム機能** → `/kids/[kidId]/FEATURE/page.tsx` + `FEATUREClient.tsx`
2. **親管理機能** → `/bank/FEATURE/page.tsx` + `FEATUREMasterClient.tsx`
3. **外部統合 API** → `/api/FEATURE/route.ts`

### Q: 新しいデータモデルを追加する場合は？

**A**:
1. `prisma/schema.prisma` に `model` 追加
2. `prisma migrate dev --name DESCRIPTION` でマイグレーション生成
3. `prisma/seed.ts` にサンプルデータ追加
4. `npm run db:seed` で反映

### Q: Server Action vs API Route の使い分けは？

**A**:
- **Server Action**: 子供・親ページでのフォーム送信、UI フロー内
- **API Route**: 外部統合（Alexa、レース WebSocket）、複雑な非同期処理

### Q: クイズ生成（Ollama）が遅い場合は？

**A**: `.env` で以下を調整：
```
OLLAMA_TIMEOUT_MS=45000      # タイムアウト延長
OLLAMA_MODEL=mistral         # より高速なモデル
OLLAMA_HOST=http://other-pc:11434  # リモート GPU 利用
```

---

## 次のステップ

### 実装予定の機能

1. **Phase 2**: Phaser.js クレーンゲーム実装
2. **Phase 3**: 罠クラフト＆捕獲ロジック完成度向上
3. **Phase 4**: レース実況生成（Gemini）＆特別ボーナス演出
4. **Cloudflare Tunnels**: 外部アクセス対応

---

**作成者**: Claude  
**最終更新**: 2026-05-18  
**参考**: `/AGENTS.md`（Next.js 16 警告）、メモリ（博物学化リフォーム 2026-05-17）
