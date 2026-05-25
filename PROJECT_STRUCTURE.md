# Chore Safari - プロジェクト構造ガイド

**作成日**: 2026-05-25
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

### コア機能（4C + Kizuna）
1. **Quest & Bank（経済・習慣化）** - クエスト設定、コイン残高管理、ストリーク（連続達成）、ペナルティ
2. **Crane & Craft（準備と在庫）** - 素材ドロップ（クレーン）、アイテム合成（クラフト）
3. **Hunt & Safari（冒険と収集）** - 動物捕獲（パッシブ罠・アクティブ狩り）、競争レース、動物クイズ
4. **House & Care（愛着とふれあい）** - 捕まえた動物とのふれあい（自分の家）、AI会話、親密度、寿命と殿堂入り
5. **Kizuna Events（ストーリー）** - 善行による恩送り（Pay-it-forward）隠しイベント

### 最新改修（2026-05-25現在）
- **Phase 5（愛着・やり込み要素）実装完了**：
  - **「自分の家」** (`app/kids/[kidId]/house/`) 機能の追加。捕まえた動物を配置してふれあえる。
  - **AIガイドキャラクター・性格システム**：Ollama連携による動的な会話（親密度により変化）。
  - **寿命・殿堂入りシステム**：時間経過で動物が寿命を迎え、殿堂入りするロジック。
  - **ストリーク機能**：お手伝いの連続達成によるボーナス・モチベーション管理。
  - **Kizuna Event（恩送り）**：隠しパラメータ`kizunaPoints`によるイベントUI実装。
  - Zustandによる状態管理の統合（`store/useSafariStore.ts`）。
  - Playwrightを用いたE2Eテストの実装 (`tests/e2e/`)。

---

## ディレクトリ構造図

```
chore-safari/
├── app/                          # Next.js App Router（ページ・API）
│   ├── api/                      # API エンドポイント
│   │   ├── alexa/                # Alexa 連携
│   │   ├── manifest/             # PWA マニフェスト
│   │   ├── quiz/                 # Ollama クイズ自動生成
│   │   └── race/                 # Ollama レース実況生成
│   ├── bank/                     # 親用銀行管理ポータル
│   │   ├── dev/                  # 開発用デバッグページ
│   │   ├── penalties/            # ペナルティマスター
│   │   ├── quests/               # クエストマスター
│   │   └── page.tsx              # メインページ
│   ├── kids/                     # 子供用ポータルハブ
│   │   ├── [kidId]/              # 個別子供エリア（ワールドマップハブ）
│   │   │   ├── craft/            # クラフト（アイテム合成）
│   │   │   ├── crane/            # クレーンゲーム（素材獲得）
│   │   │   ├── house/            # 自分の家（ベースキャンプ・動物ふれあい）
│   │   │   ├── dictionary/       # 動物図鑑（全種一覧・クイズ）
│   │   │   ├── guild/            # クエストギルド（クエスト集約ポイント）
│   │   │   ├── race/             # 動物レース
│   │   │   ├── safari/           # サファリ（狩り/ハント）
│   │   │   │   └── hunt/         # アクティブ狩り（ゲージ式タイミング）
│   │   │   └── warehouse/        # 倉庫（インベントリ+道具）
│   │   └── page.tsx              # ホーム（子供選択）
│   ├── layout.tsx                # ルートレイアウト
│   └── globals.css               # グローバルスタイル
├── components/                   # 共有コンポーネント
│   └── KizunaEventDialog.tsx     # 恩送りイベントUI
├── lib/                          # ユーティリティ・ロジック
│   ├── age.ts                    # 年齢計算
│   ├── ai-guide.ts               # AIキャラクター対話（Ollama）プロンプト管理
│   ├── ollama.ts                 # Ollama API クライアント
│   ├── prisma.ts                 # Prisma クライアント
│   ├── quest-categories.ts       # クエスト分類メタデータ
│   ├── recipes.ts                # クラフトレシピ定義
│   └── streak.ts                 # ストリーク連続達成ロジック
├── prisma/                       # データベース定義
│   ├── schema.prisma             # Prisma スキーマ
│   ├── migrations/               # DB マイグレーション履歴
│   ├── seed.ts                   # メインシードデータ
│   └── seed-ssr.ts               # SSR 用シードデータ
├── scripts/                      # 開発・保守スクリプト群
├── store/                        # Zustand ストア
│   └── useSafariStore.ts         # サファリ/ゲーム進行状態の管理
├── tests/                        # E2Eテスト
│   └── e2e/                      # Playwright テストスイート
├── public/                       # 静的資産
├── node_modules/                 # npm 依存
├── package.json                  # npm スクリプト・依存定義
├── docker-compose.yml            # PostgreSQL ローカル環境
├── .env                          # 環境変数
└── README.md                     # プロジェクト概要
```

---

## 主要ディレクトリ・機能解説

### 1️⃣ `app/bank/` - 親用銀行・マネジメントポータル
親が子供の成長と報酬を管理するダッシュボード。
- クエストの承認・却下。
- コイン残高管理、ペナルティ実行。
- （新）**ストリーク状態**の確認・救済。

### 2️⃣ `app/kids/[kidId]/` - 子供用ワールドマップ
各子供の個別プレイングエリア。
- **`house/` (自分の家)**: 新規実装されたベースキャンプ。捕まえた動物がここに配置され、AIによる対話機能や親密度の向上が行える。時間が経つと動物は天寿（寿命）を全うする。
- **`safari/` (サファリ)**: ステージと道具を選択し、狩り（パッシブ罠・アクティブ狩猟）を行う。
- **`craft/` & `crane/`**: 獲得したコインで素材を集め（クレーン）、上位の道具へ合成（クラフト）するエコサイクル。

### 3️⃣ `lib/` & `store/` - ロジック・状態管理
- **`ai-guide.ts`**: 動物ごとの性格（Personality）や親密度（Intimacy）に基づき、Ollamaに渡すコンテキストを生成する Reactor/Constraint 層。
- **`streak.ts`**: 毎日のお手伝い連続達成状況を計算・更新するロジック。
- **`useSafariStore.ts`**: クライアント側のサファリ状態やアニメーションステートを管理する Zustand ストア。

---

## データモデルの主要な更新 (2026-05-25)

| エンティティ | 新規追加フィールド / 機能 |
|---|---|
| `User` | `dailyHuntCount`, `isTestAccount`, **`kizunaPoints`** (恩送りイベント用), **`currentStreak`, `longestStreak`, `streakStatus`** (連続達成管理) |
| `CaughtAnimal` | **`intimacyScore`** (親密度), **`expiresAt`** (寿命による別れの時間), **`isAlive`** (殿堂入りフラグ), **`locationId`** (自分の家/牧場などの配置場所) |
| `AnimalPersonality` | **(新設)** 動物固有の性格、一人称、口調ルールを定義。Ollamaのプロンプト構築に利用。 |
| `UserActivity` | **(新設)** 動物をなでる、エサをやる等のふれあい行動履歴（親密度の増減を追跡）。 |

---

## 技術スタック

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, Framer Motion 11, Zustand
- **Backend**: Next.js Server Actions, Prisma 6.2, PostgreSQL
- **AI・LLM**: Ollama (ローカルLLM。クイズ、レース実況、AIキャラクター対話)
- **Testing**: Playwright (E2E Test)

---

## 開発ワークフロー

```bash
# パッケージインストール
npm install

# データベース起動とシード
npm run db:up
npm run db:migrate
npm run db:seed

# E2Eテストの実行 (Playwright)
npx playwright test

# 開発サーバー起動
npm run dev
```

---

**作成者**: Claude / Gemini
**最終更新**: 2026-05-25
