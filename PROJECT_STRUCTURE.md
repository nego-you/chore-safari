# Chore Safari — プロジェクト構造ガイド

**最終更新**: 2026-05-30（現状の実装に合わせて全面改訂）
**言語 / FW**: TypeScript / React 19 + Next.js 16（App Router）+ PostgreSQL 16（Prisma 6）

> このドキュメントは **現状のコードベースの実態** を記述します。
> 過去に「狩り・武器を廃止しテイム（仲間入り）へ全面刷新する」という構想（旧 `docs/REDESIGN_PLAN.md` /
> `prisma/schema.proposed.prisma`）がありましたが、**DB スキーマ・ルーティング・状態管理のいずれも未実装のまま破棄**
> されました。現在のアプリは旧来の「狩り（Hunt）」モデルを土台に、農場・牧場・物流などの施設や
> Gemini／VOICEVOX 連携を後付けで拡張した構成です。

---

## 📋 目次

1. [全体アーキテクチャ](#全体アーキテクチャ)
2. [ディレクトリ構造](#ディレクトリ構造)
3. [主要画面（ワールドマップの施設）](#主要画面ワールドマップの施設)
4. [データモデル一覧](#データモデル一覧)
5. [状態管理の実態](#状態管理の実態)
6. [AI・音声連携](#ai音声連携)
7. [既知の課題・技術的負債](#既知の課題技術的負債)

---

## 全体アーキテクチャ

```
                ┌──────────────────────────────────────────────┐
                │  ブラウザ（PWA / iPad 対応）                 │
                │   - ワールドマップ（施設へのハブ）           │
                │   - Zustand store（localStorage 永続化）     │
                │   - BGMPlayer / KizunaManager / 天気演出     │
                └───────────────┬──────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────────────┐
        ▼                       ▼                               ▼
┌────────────────┐   ┌──────────────────────┐    ┌──────────────────────┐
│ Server Actions │   │ Route Handlers (api) │    │ FastAPI ブリッジ      │
│ features/*     │   │ quiz / race / crane  │    │ /api/synthesize       │
│ app/**/actions │   │ gacha / coins / …    │    │   → VOICEVOX engine   │
└───────┬────────┘   └──────────┬───────────┘    └──────────────────────┘
        │                       │
        ▼                       ▼
┌────────────────┐   ┌──────────────────────┐
│ Prisma (Postgres)│  │ Google Gemini        │
│ コイン/図鑑/狩り │  │ クイズ・実況・AI対話 │
└────────────────┘   └──────────────────────┘
```

- **データ取得**は基本 React Server Components（各 `page.tsx` で `prisma` 直接呼び出し、`export const dynamic = "force-dynamic"`）。
- **更新系**は `features/*/actions.ts` または各ルートの `actions.ts`（Server Actions）。
- **動的生成系**（毎回 LLM を叩く）は Route Handler（`app/api/`）。
- **ゲーム内のコイン・在庫・スタミナ等**は Zustand + localStorage に保持（[状態管理の実態](#状態管理の実態) 参照）。

---

## ディレクトリ構造

```
chore-safari/
├── app/                                # Next.js App Router
│   ├── layout.tsx / page.tsx           # ルート（トップ）
│   ├── globals.css
│   │
│   ├── api/                            # Route Handlers
│   │   ├── alexa/                      # Alexa 連携
│   │   ├── coins/                      # コイン残高取得/同期
│   │   ├── crane/                      # クレーンゲーム抽選
│   │   ├── gacha/                      # ガチャ抽選
│   │   ├── manifest/                   # PWA マニフェスト（子供ごとアイコン）
│   │   ├── quest/submit/              # クエスト申請
│   │   ├── quiz/generate/             # 図鑑クイズ生成（Gemini）
│   │   ├── quiz/hayaoshi/             # 早押しクイズ生成（Gemini・3形式/3難易度）
│   │   └── synthesize/                # VOICEVOX TTS プロキシ（→ FastAPI backend）
│   │
│   ├── bank/                           # 親用 銀行・マネジメントポータル
│   │   ├── page.tsx                    # 承認ダッシュボード
│   │   ├── BankPortal.tsx / QuestReviewPanel.tsx / BonusPanel.tsx / PenaltyPanel.tsx / ChoreButton.tsx
│   │   ├── actions.ts                  # 承認・ボーナス・ペナルティの Server Actions
│   │   ├── quests/                     # クエストマスタ管理
│   │   ├── penalties/                  # ペナルティマスタ管理
│   │   └── dev/                        # 開発用デバッグページ
│   │
│   └── kids/
│       ├── page.tsx / KidsPortal.tsx   # 子供選択
│       ├── WorldMapPortal.tsx          # ★ワールドマップ（全施設へのハブ・天気・BGM）
│       ├── config.ts                   # GACHA_COST / CRANE_COST 等の定数
│       ├── actions.ts
│       └── [kidId]/                    # 個別子供エリア
│           ├── layout.tsx / page.tsx / loading.tsx / error.tsx
│           ├── GlobalHeader.tsx        # コイン残高等の共通ヘッダー
│           ├── SafariLayoutShell.tsx   # 子供エリアの共通シェル
│           ├── GuideContext.tsx        # AI ガイド（相棒）の状態共有
│           ├── WeatherContext.tsx      # 全画面共通の天気
│           ├── actions.ts
│           │
│           ├── quests/                 # クエスト申請（おてつだい）
│           ├── guild/                  # ギルド（コイン稼ぎ/消費系の入口を集約するハブ）
│           ├── craft/                  # クラフト工房（素材 → 道具）
│           ├── crane/                  # クレーンゲーム（素材獲得）
│           ├── safari/                 # サファリ（狩り）
│           │   └── hunt/               #   タイミングゲーム本体（罠/弓/槍）
│           ├── dictionary/             # 博物図鑑（+ 図鑑クイズ）
│           ├── house/                  # 自分の家（BaseCampClient・捕獲動物のハブ）
│           ├── ranch/                  # 牧場（動物を育てる・うんち）
│           ├── farm/                   # 農場（作物を収穫）
│           ├── zoo/                    # 動物園（展示・学び）
│           ├── logistics/              # 物流センター（エサ配送）
│           ├── flow/                   # ぜんぶの「ながれ」可視化ページ
│           ├── quiz/                   # 早押しクイズ（ゲームセンター）
│           ├── race/                   # カオスレース
│           └── warehouse/              # 倉庫（インベントリ閲覧）
│
├── components/                         # 共有コンポーネント
│   ├── BGMPlayer.tsx                   # 画面連動 BGM
│   ├── GuideChatModal.tsx              # AI ガイドとの対話モーダル
│   ├── KizunaManager.tsx               # おたがいさまイベントの全画面制御
│   └── KizunaEventDialog.tsx           # おたがいさまイベント UI
│
├── features/                           # 機能ドメイン別 Server Actions
│   ├── craft/actions.ts                # クラフト
│   ├── crane/actions.ts                # クレーンゲーム
│   ├── gacha/actions.ts                # ガチャ
│   ├── quest/actions.ts                # クエスト申請・承認
│   ├── race/actions.ts                 # レース
│   ├── safari/actions.ts               # 狩り（罠設置・タイミング判定・捕獲）
│   └── notifications/actions.ts        # ボーナス/ペナルティ通知
│
├── actions/
│   └── guide.ts                        # AI ガイド対話の Server Action
│
├── lib/                                # ユーティリティ・ロジック
│   ├── prisma.ts                       # Prisma クライアント（シングルトン）
│   ├── gemini.ts                       # Gemini クライアント（geminiGenerateObject）
│   ├── ai-guide.ts                     # AI ガイド（3R/3C アーキテクチャ・Gemini）
│   ├── kizunaScenarios.ts              # おたがいさまイベントのシナリオ定義
│   ├── quest-categories.ts             # クエスト分類メタデータ
│   ├── recipes.ts                      # クラフトレシピ定義
│   ├── streak.ts                       # ストリーク連続達成ロジック
│   └── age.ts                          # 誕生日 → 年齢の動的計算
│
├── store/
│   └── useSafariStore.ts               # Zustand（コイン/在庫/スタミナ/動物/絆/BGM）
│
├── types/
│   └── safari.ts                       # ゲーム内型（GameAnimal / InventoryMap / Medal 等）
│
├── prisma/
│   ├── schema.prisma                   # ★現行スキーマ（Hunt/Tool ベース）
│   ├── migrations/                     # マイグレーション履歴
│   ├── seed.ts / seed-ssr.ts           # マスターデータ投入
│   └── migration_lock.toml
│
├── backend/                            # VOICEVOX TTS ブリッジ（Python / FastAPI）
│   ├── main.py                         # /synthesize（audio_query → synthesis → WAV）
│   ├── Dockerfile
│   └── requirements.txt
│
├── scripts/                            # 運用スクリプト
│   ├── generate-icons.mjs              # PWA アイコン生成
│   ├── reset-coins.ts / reset-coins-hard.ts
│   ├── reset-dictionary.ts
│   ├── migrate-is-test.sql
│   └── test-gemini.mjs
│
├── tests/                              # Playwright E2E
├── public/                             # 静的アセット（アイコン・BGM 13曲・効果音）
├── docker-compose.yml                  # web / web-prod / db / voicevox_engine / backend / cloudflared
├── Dockerfile.dev / Dockerfile.prod
├── next.config.ts                      # typescript.ignoreBuildErrors / serverActions.allowedOrigins
├── package.json
├── README.md / AGENTS.md / CLAUDE.md
└── PROJECT_STRUCTURE.md
```

---

## 主要画面（ワールドマップの施設）

ワールドマップ（[WorldMapPortal](app/kids/WorldMapPortal.tsx)）のピンから各施設へ遷移します。

| 施設（ピン） | ルート | 役割 |
|---|---|---|
| クエストギルド | `quests` | お手伝い・クエストの申請 |
| クラフト工房 | `craft` | 素材を組み合わせて道具を作る |
| 罠スタイル | `safari?style=passive` | 罠＋エサを仕掛けて待つパッシブ狩り |
| アクティブ狩り | `safari?style=active` | 弓・槍でゲージ式タイミング狩り（回数制限あり） |
| 自分の家 | `house` | 捕獲動物のハブ・親密度・AI 会話 |
| 牧場 | `ranch` | 動物を育てる・うんちを回収 |
| 農場 | `farm` | 作物を収穫（牧場エサ・動物園ケアに利用） |
| 動物園 | `zoo` | 動物を展示・学ぶ |
| 物流センター | `logistics` | エサを運ぶ・配送 |
| 博物図鑑 | `dictionary` | 図鑑閲覧＋クイズ |
| カオスレース | `race` | 5レーンのベット式レース。実況はクライアント側の乱数生成（LLM 不使用） |
| ながれ | `flow` | ゲーム全体の流れの可視化 |
| ゲームセンター（モーダル） | — | クレーンゲーム / 早押しクイズ / サファリスロット（準備中） |

> **補足**: `guild/` は「コインを稼ぐ／使う」系の入口を集約するハブページとして別途存在し、
> ワールドマップの「クエストギルド」ピンは `quests`（申請画面）へ直接遷移します。両者は役割が一部重複しています。

---

## データモデル一覧

現行スキーマ（[prisma/schema.prisma](prisma/schema.prisma)）は **「狩り（Hunt）」世界観**のままです。

### Enum

| Enum | 値 |
|---|---|
| `UserRole` | `CHILD` / `PARENT` |
| `CoinTxKind` | `CHORE` / `PENALTY` / `BONUS` / `GACHA` / `ADJUSTMENT` |
| `ItemType` | `FOOD`（廃止・履歴用）/ `TRAP_PART`（廃止・履歴用）/ `MATERIAL` |
| `Rarity` | `COMMON` / `RARE` / `EPIC` / `LEGENDARY` |
| `QuestStatus` | `PENDING` / `APPROVED` / `REJECTED` |
| `HuntType` | `TRAP` / `BOW` / `SPEAR` / `WEAPON` |
| `ToolType` | `TRAP` / `BOW` / `SPEAR` / `WEAPON` |
| `HuntStatus` | `PLACED` / `APPEARED` / `CAUGHT` / `ESCAPED` |

### モデル

| モデル | 役割・主なフィールド |
|---|---|
| `User` | 子供/親。`coinBalance`、狩り回数制限（`dailyHuntCount`/`lastHuntDate`）、ストリーク（`currentStreak` 等）、絆（`kizunaPoints`/`helpedGrandma`）、相棒（`activeGuideAnimalId`）、`isTestAccount` |
| `CoinTransaction` | コイン増減の取引履歴（`kind`/`amount`/`reason`） |
| `Quest` / `QuestSubmission` | クエストマスタ（`category`: CHORE/STUDY/LIFE・`targetUsers`）と申請（`status`） |
| `Penalty` / `PenaltyNotification` | ペナルティマスタと通知 |
| `SpecialBonusNotification` | 特大ボーナス通知 |
| `Animal` | 図鑑マスタ。`genericName`/`specificName`、`rarity`、`habitat`/`location`/`era`、`lifespanYears`、`stageId` |
| `Stage` | 生息地カテゴリ（savanna / forest / ice_age / deep_sea / cretaceous） |
| `CaughtAnimal` | 捕獲履歴（家族共有図鑑）。`expiresAt`/`isAlive`（寿命）、`intimacyScore`（親密度）、`personalityId` |
| `Personality` | AI ガイドの性格マスタ（`firstPerson`/`toneRule`） |
| `Hunt` | 進行中の狩り（`huntType`、`status`、`appearsAt`、`targetAnimalId`、`posX/posY`） |
| `Tool` | 道具マスタ（罠/弓/槍/武器、`successRateBonus`、`historicalContext`、`consumable`） |
| `Material` / `UserMaterial` | 素材マスタとユーザー所持数 |
| `UserTool` | ユーザーの道具所持数 |
| `SharedInventoryItem` | 家族共有インベントリ（倉庫） |
| `GachaTransaction` | ガチャ履歴 |
| `UserActivity` | 機能利用履歴（AI ガイドの未利用機能誘導に使用） |

> ⚠️ 旧構想にあった `TameSession` / `TameItemMaster` / `AnimalCompanion` / `PoopLog` / `FarmPlot` /
> `NpcRelation` / `UserInventoryItem` / `DonationNotification` などは **存在しません**。

---

## 状態管理の実態

> ⚠️ **重要**: 旧ドキュメントは「DB = Single Source of Truth、Zustand は UI 状態のみ」と規定していましたが、
> **現状はその方針どおりになっていません**。ゲーム内経済の多くが Zustand + localStorage に保持されています。

### Zustand（[store/useSafariStore.ts](store/useSafariStore.ts)・`persist` で localStorage 永続化）

```
coins              … ゲーム内コイン残高（DB の coinBalance とは別管理。initCoins/syncCoins で同期）
inventory          … 素材・作物などの所持マップ
animalsInYard      … 裏庭に一時保護中の動物
logisticsQueue     … 物流センターで配送待ちの動物
stamina            … 体力（0–100）
medals             … 勲章
kizunaPoints / kindnessCount / pendingReturns / kizunaBadgeCount  … おたがいさまイベント
kizunaPlanDate / kizunaPlanKind / kizunaFiredDate                 … 1日1回の発火制御
bgmMuted           … BGM ミュート
```

### DB（Prisma）が正として扱う領域

```
coinBalance（親の承認・ペナルティで増減）/ CoinTransaction
CaughtAnimal（図鑑）/ Hunt / Tool / Material / UserMaterial / UserTool
Quest / QuestSubmission / Penalty / 通知系 / GachaTransaction
```

### コインの二重管理に注意

- `coinBalance`（DB）… 親の承認フロー（Bank）・クレーン/ガチャの API がトランザクションで増減。
- `coins`（Zustand）… ページロード時に DB 値で初期化（`initCoins`）し、サーバー応答で上書き（`syncCoins`）するが、
  ゲーム内の `addCoins`/`spendCoins` はクライアントローカルでも増減する。
- → **DB と localStorage が乖離しうる**。詳細は [既知の課題](#既知の課題技術的負債) を参照。

---

## AI・音声連携

### Google Gemini（[lib/gemini.ts](lib/gemini.ts)）
- Vercel AI SDK（`@ai-sdk/google`）の `generateText` ＋ 手動 JSON パース＋ Zod 検証（`geminiGenerateObject`）。
- 用途: 早押しクイズ（`/api/quiz/hayaoshi`）、図鑑クイズ（`/api/quiz/generate`）、AI ガイド対話（[lib/ai-guide.ts](lib/ai-guide.ts)）。
- **レースは LLM 不使用**: 現行のカオスレース（[RacePlayer](app/kids/[kidId]/race/RacePlayer.tsx)）はクライアント側の乱数で実況・進行を生成し、ベット結果のみ Server Action（`betOnRace`/`claimRaceReward`）で確定する。かつて存在したレース実況 API（`/api/race` の Gemini 版・`/api/race/generate` の Ollama 版）は未使用のため削除済み。これにより **コードベースから Ollama 依存は消滅**した。
- AI ガイドは **3R/3C アーキテクチャ**: Receptor（Prisma で状況収集）→ Constraint（優先度・プロンプト構築）→ Reactor（Gemini 呼出）。

### VOICEVOX TTS（[backend/main.py](backend/main.py)）
- FastAPI ブリッジが Next.js の `/api/synthesize` から呼ばれ、同一 Docker ネットワークの `voicevox_engine` へ
  `audio_query → synthesis` を順に投げて WAV を返す。話者は環境変数 `VOICEVOX_SPEAKER_ID`（既定: ずんだもん=3）。

---

## 既知の課題・技術的負債

ドキュメント整理にあたり確認できた改善候補です。

1. **コインの二重管理（最重要・未対応）**
   DB の `coinBalance` と Zustand/localStorage の `coins` が並存し、`addCoins`/`spendCoins` はローカルのみで増減する経路がある。
   リロード・複数端末・タブ間で残高が乖離しうる。**コイン増減を Server Action 経由に一本化**し、Zustand はキャッシュに徹するのが望ましい。

2. **`guild/` と `quests/` の役割重複（未対応）**
   ワールドマップは `quests` に直行する一方、`guild/` ハブも存在。導線を整理するか、片方をリダイレクトに。

3. **`typescript.ignoreBuildErrors: true`（要判断）**
   Next.js 16 の日本語ソースでの code-frame パニック回避が理由（[next.config.ts](next.config.ts) のコメント参照）だが、
   本番ビルドが型エラーを素通しする状態。CI 等で別途 `tsc --noEmit` を回す運用が望ましい。

4. **狩り（武器）世界観の温度感（要判断）**
   README のコアサイクルは「狩り・武器」を前提にしている。旧構想の「友好的なテイム」への揺り戻しを今後やるかは要判断
   （本ドキュメントは現状を正として記述）。

### 対応済み（2026-05-30）

- ✅ `docker-compose.yml` の死んだ `OLLAMA_HOST` を削除（web / web-prod）。
- ✅ [lib/ai-guide.ts](lib/ai-guide.ts) の旧 Ollama コメントを Gemini に修正。
- ✅ [lib/gemini.ts](lib/gemini.ts) の既定モデルを廃止済み `gemini-1.5-flash` → `gemini-2.5-flash` に統一（compose と一致）。
- ✅ 孤立していたレース実況 API（`app/api/race`・`app/api/race/generate`）と疎通スクリプト `scripts/test-race-api.mjs` を削除。陳腐化していたレースの E2E テストも除去。**Ollama 依存はコードベースから消滅**。

---

**参照**: [README.md](README.md)（起動方法・技術スタック・環境変数）
