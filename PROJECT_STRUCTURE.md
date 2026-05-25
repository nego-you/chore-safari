# Chore Safari - プロジェクト構造ガイド（新・エコシステム版）

**最終更新**: 2026-05-25（大規模リフォーム版）
**プロジェクト**: Chore Safari（チョア・サファリ）
**言語**: TypeScript / React + Next.js (App Router) + PostgreSQL

---

## 📋 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [コアシステム（8つのながれ）](#コアシステム)
3. [ディレクトリ構造図](#ディレクトリ構造図)
4. [主要ディレクトリ解説](#主要ディレクトリ解説)
5. [データモデル一覧](#データモデル一覧)
6. [状態管理の設計方針](#状態管理の設計方針)
7. [技術スタック](#技術スタック)

---

## プロジェクト概要

### コンセプト

**「動物と仲良くなり、自然と共生し、他者に優しくする」**

現実のお手伝い・学習を通じてコインを稼ぎ、そのコインと知恵を使って様々な時代・生息地の動物たちと友達になる、温かいエコシステム型の知育プラットフォーム。武器や狩りの概念を完全に廃止し、音楽・おもちゃ・好きな食べ物で動物の心を開くテイム（仲間入り）システムへ刷新。

### コアシステム（8つのながれ）

**1. お手伝いと親の承認（Quest & Bank）**
子供がお手伝いを報告 → 親が Bank 画面から承認 → コインが DB に付与される。
ペナルティは「どうぶつ保護活動への寄付（自動控除）」として温かく表現。

**2. 動物とのふれあい（Field & Tame）**
フィールドで動物に出会い、楽器・おもちゃ・誘いエサでテイム（仲間入り）させる。
仲間になった動物は BaseCamp へ。その後、牧場 or 動物園へ自由に配置。

**3. 動物の日々の世話（BaseCamp / Farm）**
動物には空腹度・機嫌ステータスがある。エサをあげないと糞を落とさなくなり、
おもちゃで遊んであげないと機嫌が下がる（AI 対話のトーンにも影響）。

**4. 完全エコな循環（Farm → Garden → 工房）**
牧場の糞を回収 → 農場で肥料として使い野菜を育てる → 収穫して動物のエサに。
足りない分のエサや肥料のみコインで購入する補填システム。

**5. インベントリ管理（倉庫）**
糞・肥料・野菜・素材・おもちゃ等を統合インベントリ（UserInventoryItem）で管理。
カテゴリ別に分類して倉庫画面に表示する。

**6. 経済の娯楽（ゲームセンター Arcade）**
クレーンゲーム（素材獲得）とカオスレース（Ollama 実況）を Arcade に集約。
コイン消費の主要な場として機能する。

**7. スタミナのながれ**
最大スタミナは固定で現実時間のみで回復。スタミナゼロでも図鑑・AI 会話・
眺めるだけで過ごせる動線を確保する。

**8. 恩送りのながれ（Kizuna Events）**
マップ上の NPC にアイテムを無償であげると kizunaPoints が蓄積。
農場の台風などピンチ時に、かつて助けた NPC の縁者が無償で助けてくれる。
詰み防止（動物ゼロでエコサイクルが止まった時の救済）としても機能する。

---

## ディレクトリ構造図

```
chore-safari/
├── app/                                # Next.js App Router
│   ├── api/
│   │   ├── alexa/                      # Alexa 連携
│   │   ├── chat/                       # AI キャラクター対話 API（Ollama）
│   │   ├── manifest/                   # PWA マニフェスト
│   │   ├── quiz/                       # Ollama クイズ自動生成
│   │   └── race/                       # Ollama レース実況生成
│   │
│   ├── bank/                           # 親用銀行・マネジメントポータル
│   │   ├── dev/                        # 開発用デバッグページ
│   │   ├── penalties/                  # ペナルティ（寄付）マスタ管理
│   │   ├── quests/                     # クエストマスタ管理
│   │   └── page.tsx                    # 承認ダッシュボード
│   │
│   └── kids/
│       ├── page.tsx                    # 子供選択画面
│       └── [kidId]/                    # 個別子供エリア（ワールドマップハブ）
│           ├── page.tsx                # ワールドマップ（ハブ画面）
│           │
│           ├── basecamp/               # BaseCamp（旧 house/）
│           │   ├── page.tsx            # 仲間一覧・ふれあいハブ
│           │   └── [companionId]/      # 個別動物ふれあい詳細
│           │       └── page.tsx        # AI 会話・エサやり・おもちゃ
│           │
│           ├── field/                  # フィールド（旧 safari/）
│           │   ├── page.tsx            # ステージ選択マップ
│           │   └── [stageId]/          # ステージ別フィールド
│           │       └── page.tsx        # テイムゲーム画面
│           │
│           ├── farm/                   # 牧場（新設）
│           │   ├── page.tsx            # 牧場全体（動物一覧・糞回収）
│           │   └── [plotId]/           # 区画詳細（配置動物の世話）
│           │       └── page.tsx
│           │
│           ├── zoo/                    # 動物園（新設）
│           │   └── page.tsx            # 展示中の動物一覧
│           │
│           ├── garden/                 # 農場・菜園（新設）
│           │   └── page.tsx            # 区画ごとの野菜育成
│           │
│           ├── workshop/               # 工房（旧 craft/）
│           │   └── page.tsx            # 素材 → アイテムクラフト
│           │
│           ├── arcade/                 # ゲームセンター（旧 crane/ + race/ を統合）
│           │   ├── page.tsx            # ゲームセンターハブ
│           │   ├── crane/              # クレーンゲーム（素材獲得）
│           │   │   └── page.tsx
│           │   └── race/               # カオスレース（Ollama 実況）
│           │       └── page.tsx
│           │
│           ├── dictionary/             # 動物図鑑（継続）
│           │   ├── page.tsx            # 全種一覧・クイズ
│           │   └── [animalId]/         # 個別動物図鑑
│           │       └── page.tsx
│           │
│           ├── guild/                  # クエストギルド（継続）
│           │   └── page.tsx            # クエスト申請・状況確認
│           │
│           └── warehouse/              # 倉庫（統合インベントリ）
│               └── page.tsx            # カテゴリ別アイテム一覧
│
├── components/                         # 共有コンポーネント
│   ├── KizunaEventDialog.tsx           # 恩送りイベントUI
│   ├── StaminaBar.tsx                  # スタミナ表示
│   ├── AnimalStatusCard.tsx            # 動物ステータス（空腹度・機嫌）
│   └── EcoFlowIndicator.tsx            # エコサイクル状況表示
│
├── lib/                                # ユーティリティ・ロジック（副作用なし）
│   ├── age.ts                          # 年齢計算
│   ├── ai-guide.ts                     # AIキャラクター対話（Ollama）プロンプト管理
│   ├── items.ts                        # アイテムマスタ定数
│   ├── recipes.ts                      # クラフトレシピ定義
│   ├── stamina.ts                      # スタミナ回復計算ロジック
│   ├── animal-status.ts                # 空腹度・機嫌の時間経過計算ロジック
│   ├── eco-cycle.ts                    # エコサイクルロジック
│   ├── ollama.ts                       # Ollama API クライアント
│   ├── prisma.ts                       # Prisma クライアント
│   ├── quest-categories.ts             # クエスト分類メタデータ
│   └── streak.ts                       # ストリーク連続達成ロジック
│
├── actions/                            # Server Actions（DB Single Source of Truth）
│   ├── coin.ts                         # コイン増減（トランザクション保証）
│   ├── quest.ts                        # クエスト承認・却下
│   ├── tame.ts                         # テイムセッション管理
│   ├── companion.ts                    # 動物配置・世話・殿堂入り
│   ├── farm.ts                         # 農場作業（種まき・収穫・肥料）
│   ├── inventory.ts                    # インベントリ増減
│   ├── stamina.ts                      # スタミナ消費
│   └── kizuna.ts                       # 恩送りイベント・NPC 関係管理
│
├── store/                              # Zustand ストア（UI 状態のみ）
│   ├── useUIStore.ts                   # アニメーション・モーダル・トースト
│   └── useSafariStore.ts               # フィールドのアニメーション・ゲーム演出
│
├── prisma/
│   ├── schema.prisma                   # 現行スキーマ（旧 Hunt ベース）
│   ├── schema.proposed.prisma          # 新エコシステム版スキーマ（移行提案）
│   ├── migrations/
│   ├── seed.ts
│   └── seed-ssr.ts
│
├── docs/
│   └── REDESIGN_PLAN.md               # 移行ロードマップ（詳細）
│
├── tests/
│   └── e2e/                            # Playwright E2E テスト
│
├── scripts/
├── public/
├── package.json
├── docker-compose.yml
├── .env
└── README.md
```

---

## 主要ディレクトリ解説

### 🏕️ `app/kids/[kidId]/basecamp/` — BaseCamp（旧: house/）

仲間になった動物が最初に来る場所。デフォルトの安全地帯。

- 動物一覧（currentLocation=BASECAMP）の表示
- 個別動物詳細ページで「エサやり」「おもちゃ」「AI 会話」を実行
- 牧場・動物園への「配置」（アサイン）ボタン
- 空腹度・機嫌のリアルタイム表示（Server Action で算出した値を表示）

### 🌾 `app/kids/[kidId]/farm/` — 牧場（新設）

FARM 配置された動物が暮らす場所。エコサイクルの起点。

- 配置済み動物の世話（エサやり）
- 糞の回収ボタン（PoopLog.isCollected=false の行をカード表示）
- 糞が溜まりすぎると動物の機嫌が下がる演出

### 🥕 `app/kids/[kidId]/garden/` — 農場・菜園（新設）

野菜を育ててエサを自給するエコサイクルの中核。

- 区画（FarmPlot）ごとに種まき・肥料投入・収穫
- 肥料（FERTILIZER）を使うと readyAt が短縮
- 収穫した野菜（CROP）→ 倉庫に追加 → エサとして使用

### 🦁 `app/kids/[kidId]/zoo/` — 動物園（新設）

ZOO 配置された動物を展示する場所。

- 展示中の動物一覧と解説
- 来場 NPC が喜んで kizunaPoints が微増する演出

### 🏞️ `app/kids/[kidId]/field/` — フィールド（旧: safari/）

動物と出会い、テイムする場所。武器は完全廃止。

- ステージ（savanna / forest / ice_age 等）選択
- テイム方法（楽器・おもちゃ・誘いエサ）を選択してスタミナ消費
- タイミングゲームで BEFRIENDED / FLED が決まる

### 🎮 `app/kids/[kidId]/arcade/` — ゲームセンター（旧: crane/ + race/ を統合）

コイン消費の娯楽施設。

- **クレーンゲーム**: コイン消費で素材（MATERIAL）をドロップ
- **カオスレース**: Ollama が実況する 30 秒レース

### 🔨 `app/kids/[kidId]/workshop/` — 工房（旧: craft/）

素材を組み合わせてアイテムをクラフト。旧・武器クラフトを全面置き換え。

- 誘いエサ（LURE）、おもちゃ（TOY）、楽器（MUSIC_ITEM）
- 肥料（FERTILIZER）、スタミナ軽減ツール（CRAFT_TOOL）

---

## データモデル一覧

| モデル | 旧モデル名 | 主な変更点 |
|---|---|---|
| `AnimalCompanion` | `CaughtAnimal` | `currentLocation` / `hungerLevel` / `moodLevel` / `lastFedAt` / `lastPlayedAt` 追加 |
| `TameSession` | `Hunt` | `HuntType/Status` → `TameMethod/Status` に全面置き換え |
| `TameItemMaster` | `Tool` | `ToolType(BOW/SPEAR/WEAPON)` → `TameMethod(MUSIC/TOY/LURE/SONG)` |
| `UserInventoryItem` | `UserMaterial` + `UserTool` | 統合。`ItemCategory` で分類管理 |
| `DonationNotification` | `PenaltyNotification` | 名前変更・UI 表現を「寄付」に |
| `AnimalCareLog` | *(新設)* | 世話アクションの履歴と delta 値を記録 |
| `PoopLog` | *(新設)* | 糞の生成・回収ライフサイクル管理 |
| `FarmPlot` | *(新設)* | 農場区画の種まき・収穫状態管理 |
| `NpcRelation` | *(新設)* | 恩送り NPC との関係・助けた回数管理 |
| `FamilySharedItem` | `SharedInventoryItem` | 家族共有アイテムのみに限定 |
| `CoinTxKind.DONATION` | `CoinTxKind.PENALTY` | 表現変更（減算の実装は同じ） |

詳細は `prisma/schema.proposed.prisma` を参照。

---

## 状態管理の設計方針

### DB = Single Source of Truth

コイン・スタミナ・インベントリ・動物ステータスは必ず DB を正として扱う。
すべての増減・変化は `actions/` 配下の Server Actions 内のトランザクションで行う。

```
[子供の操作] → Server Action → prisma.$transaction([
  コインの増減,
  CoinTransaction の INSERT,
  関連状態の更新
]) → return 新しい状態
```

### Zustand の用途を UI 状態のみに限定

```typescript
// ✅ Zustand で管理してよいもの
useUIStore: モーダルの開閉、トーストの表示、アニメーション中フラグ
useSafariStore: タイミングゲームの演出状態、フィールドのアニメーション

// ❌ Zustand で管理してはいけないもの
coinBalance, staminaCurrent, hungerLevel, moodLevel, inventory
→ これらは Server Action の戻り値 or React Server Components で取得する
```

### 時間経過ステータスの計算パターン

空腹度・機嫌・スタミナは「最終更新日時」を DB に保持し、表示時または Server Action 実行時に経過時間から現在値を算出して書き込む。

```typescript
// lib/animal-status.ts の例
export function calcHungerLevel(lastFedAt: Date, baseLevel: number): number {
  const hoursPassed = (Date.now() - lastFedAt.getTime()) / 3_600_000;
  return Math.max(0, baseLevel - Math.floor(hoursPassed * 5)); // 1時間で-5
}
```

---

## 技術スタック

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Framer Motion, Zustand
- **Backend**: Next.js Server Actions, Prisma 6+, PostgreSQL
- **AI・LLM**: Ollama（クイズ・レース実況・AIキャラクター対話）
- **Testing**: Playwright（E2E テスト）
- **Infrastructure**: Docker（docker-compose で PostgreSQL をローカル起動）

---

## 開発ワークフロー

```bash
# パッケージインストール
npm install

# データベース起動とシード
npm run db:up
npm run db:migrate
npm run db:seed

# E2E テストの実行
npx playwright test

# 開発サーバー起動
npm run dev
```

---

**作成者**: Claude
**最終更新**: 2026-05-25
**参照**: `docs/REDESIGN_PLAN.md`（移行ロードマップ詳細）
