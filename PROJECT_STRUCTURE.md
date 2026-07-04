# Chore Safari — プロジェクト構造ガイド

**最終更新**: 2026-06-12（一本道化リフォームを反映）
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
│   ├── KizunaManager.tsx               # おたがいさまイベントの全画面制御（ページ移動毎 5% 抽選＋クールダウン）
│   └── KizunaEventDialog.tsx           # おたがいさまイベント UI
│
├── features/                           # 機能ドメイン別 Server Actions
│   ├── coins/actions.ts                # コイン増減（adjustCoins・トランザクション）★2026-05-30
│   ├── inventory/actions.ts            # 在庫の取得/スナップショット保存 ★2026-05-30
│   ├── kizuna/actions.ts               # おたがいさま進捗の取得/保存（DB User）★2026-05-31
│   ├── crane/actions.ts                # クレーンゲーム（コイン消費のみ。景品はクライアント抽選）
│   ├── gacha/actions.ts                # ガチャ
│   ├── quest/actions.ts                # クエスト申請（submitQuest。承認 approveQuest は app/bank/actions.ts）
│   ├── race/actions.ts                 # レース（ベット確定）
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
│   ├── streak.ts                       # ストリーク連続達成ロジック
│   └── age.ts                          # 誕生日 → 年齢の動的計算
│
├── store/
│   └── useSafariStore.ts               # Zustand（コイン/在庫/スタミナ/動物/絆/BGM）
│
├── types/
│   └── safari.ts                       # ゲーム内型（InventoryMap）
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

> **一本道化（2026-06-12）**: 機能肥大化による「迷い」を解消するため、マップの表示ピンを
> コアループの6つに絞った（[docs/DESIGN_PRINCIPLES.md](docs/DESIGN_PRINCIPLES.md) 準拠）。
> コアループ＝【🏰お手伝い → 📦うんぱん → 🦁罠/🏹狩り（直前にクイズ必須）→ 🏠家 → 📚図鑑】。
> 非表示ピンは [app/kids/config.ts](app/kids/config.ts) の `HIDDEN_PIN_IDS` で制御
> （コード・ページは残置。ID を外せば復活）。

### 表示中（コアループの6ピン）

| 施設（ピン） | ルート | 役割 |
|---|---|---|
| クエストギルド | `quests` | お手伝い・クエストの申請（LOGISTICS カテゴリは除外表示） |
| うんぱんミッション | `logistics` | **現実のモノの運搬おてつだい**を申請。承認でコイン＋レア罠（旧エサ配送ミニゲームは廃止） |
| 罠スタイル | `safari?style=passive` | 罠を仕掛けて待つパッシブ狩り。**設置直前にクイズ必須・1日3回まで** |
| アクティブ狩り | `safari?style=active` | 探索型の狩り。**出発直前にクイズ必須**・捕獲は1日3回まで |
| 自分の家 | `house` | 捕獲動物のハブ・親密度・AI 会話 |
| 博物図鑑 | `dictionary` | 図鑑閲覧＋クイズ |

### 非表示（HIDDEN_PIN_IDS。URL 直アクセスは可能）

| 施設 | ルート | 備考 |
|---|---|---|
| クラフト工房 | `craft` | Zustand トイ実装（DB の UserTool に未接続）。罠入手は「コイン購入＋うんぱん報酬」に移行 |
| 農場 / 牧場 / 動物園 | `farm` / `ranch` / `zoo` | 画面内で完結する作業系のため隠蔽 |
| カオスレース | `race` | 同上 |
| ゲームセンター | （モーダル） | クレーン / 早押し / スロット。ピンごと非表示 |
| ながれ | `flow` | 一本道化により役割消滅 |

> **補足**: 旧 `guild/` ハブは削除済み。クエストの入口は `quests` に一本化。

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
| `User` | 子供/親。`coinBalance`、狩り回数制限（`dailyHuntCount`/`lastHuntDate`）、罠設置回数制限（`dailyTrapCount`/`lastTrapDate` ★2026-06-12）、ストリーク（`currentStreak` 等）、絆（`kizunaPoints`/`helpedGrandma`）、相棒（`activeGuideAnimalId`）、`isTestAccount` |
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
| `UserTool` | ユーザーの道具所持数 |
| `SharedInventoryItem` | 家族共有インベントリ（倉庫） |
| `GachaTransaction` | ガチャ履歴 |
| `UserActivity` | 機能利用履歴（AI ガイドの未利用機能誘導に使用） |
| `GameInventoryItem` | ゲーム内の流動在庫（`itemKey`×`quantity`／単一書き手・スナップショット同期）★2026-05-30 追加 |

> ⚠️ 旧構想にあった `TameSession` / `TameItemMaster` / `AnimalCompanion` / `PoopLog` / `FarmPlot` /
> `NpcRelation` / `UserInventoryItem` / `DonationNotification` などは **存在しません**。
> また `Material` / `UserMaterial`（旧クラフト用素材）は **2026-05-31 のマイグレーションでドロップ済み**で、
> 現行スキーマには存在しません（クレーンは UserMaterial への二重書き込みを廃止。クラフト工房の素材は
> Zustand のローカル型で、DB とは無関係）。

---

## 状態管理の実態

> 2026-05-30 に **コイン・在庫を DB 権威化**するリファクタを実施（案B）。設計は [docs/COIN_INVENTORY_REFACTOR.md](docs/COIN_INVENTORY_REFACTOR.md)。
> Zustand は「常に DB 値で上書きされるミラー」として運用する方針に変更。

### Zustand（[store/useSafariStore.ts](store/useSafariStore.ts)・`persist` で localStorage 永続化）

```
coins              … コイン残高ミラー。ロード時に DB 値でハイドレート、増減後は必ず syncCoins
inventory          … 在庫ミラー。DB(GameInventoryItem) を正とし、変更は debounce で DB へスナップショット保存
stamina            … 体力（0–100）。設計上エフェメラル（ゲーム再開で全回復）のため DB 化しない
kizunaPoints / kindnessCount / pendingReturns / kizunaBadgeCount  … おたがいさまイベントの進捗。DB(User) ミラー（スナップショット同期）
kizunaPlanDate / kizunaPlanKind / kizunaFiredDate                 … 【レガシー】旧「1日1回 予定→発火」方式の名残。DB(User) ミラーとして同期は続くが発火判定には未使用（→「おたがいさま（Kizuna）の発火」参照）
bgmMuted / _hydrated（非永続）… BGM ミュート / ハイドレート済みフラグ

※ 動物データ（捕獲）は DB(CaughtAnimal) が唯一のソース。旧 animalsInYard/logisticsQueue/medals/_stats は撤去済み。
```

> パッシブ罠（SafariClient）に加え、**アクティブ狩り（HuntClient）の捕獲も DB CaughtAnimal に永続化**するようになった
> （`recordActiveHuntCatch`）。図鑑・レース・倉庫・他端末すべてに反映される。

### DB（Prisma）が正として扱う領域

```
coinBalance（親の承認・ゲーム両方／全増減トランザクション）/ CoinTransaction
GameInventoryItem（草・石・うんち・作物・素材などの流動在庫）★今回追加
CaughtAnimal（図鑑）/ Hunt / Tool / UserTool
Quest / QuestSubmission / Penalty / 通知系 / GachaTransaction
```

### コインと在庫の同期ルール（DB = Single Source of Truth）

- **コイン**は書き手が2人（子供のゲーム＋親の Bank）。必ずトランザクション型サーバアクションで
  increment/decrement（[features/coins/actions.ts](features/coins/actions.ts) の `adjustCoins`、クレーン/レース/クイズ/卒業も同様）→ 戻り値で `syncCoins`。
- **在庫**は書き手が1人（子供本人）。[features/inventory/actions.ts](features/inventory/actions.ts) の `getInventory`/`saveInventory` で
  ロード時ハイドレート＋ debounce スナップショット保存（last-write-wins）。同期は [SafariLayoutShell](app/kids/[kidId]/SafariLayoutShell.tsx) が常駐制御。
- ロード時は [layout.tsx](app/kids/[kidId]/layout.tsx) が DB から coins+inventory を読み、`hydrateFromServer` で**必ず DB 値を採用**。

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

## おたがいさま（Kizuna）の発火

「おたがいさま（恩送り）」イベントは [components/KizunaManager.tsx](components/KizunaManager.tsx) が全画面共通で制御する（ワールドマップ・各ステージのどこでもマウントされる）。

### 現行の発火ロジック（2026-05 改訂）
- **トリガー**: `pathname`（ページ移動）が変わるたびに **5%（`TRIGGER_CHANCE = 0.05`）** で抽選。ログイン時に限らない。
- **クールダウン**: 直前の発火から **10 秒（`COOLDOWN_MS = 10_000`）** は再発火しない（`lastFiredRef`。クライアントのみ・非永続）。
- **種類の決定**: `pendingReturns > 0` なら「お返し（return）」を優先、無ければ「お願い（ask）」。シナリオは [lib/kizunaScenarios.ts](lib/kizunaScenarios.ts) の `pickAsk()` / `pickReturn()` から抽選。
- **3択の結果**: お願いは「やさしい／ふつう／いじわる」。`KIZUNA_CHOICE_META` の `grantReturn`/`points` を `recordKizunaResult` に反映。**やさしい時だけ** `kindnessCount++` / `pendingReturns++`（後日お返しが返る）。お返しを受け取ると `redeemReturn`（`pendingReturns--`・`kizunaBadgeCount++`）。

### レガシー（旧「1日1回 予定→発火」方式の名残）
- かつては「その日に出すか・お願いか お返しか」を1日1回抽選して `kizunaPlanDate`/`kizunaPlanKind` に保存し、ランダムなタイミングで発火したら `kizunaFiredDate` を立てて以降その日は出さない、という方式だった。
- 現在は上記の「移動毎 5%」方式に置き換わり、**この予定/発火日フィールドは発火判定に使われない**。
- ただし `User`（DB）の `kizunaPlanDate`/`kizunaPlanKind`/`kizunaFiredDate` 列、store の同名フィールド、`getKizuna`/`saveKizuna` のスナップショット同期は**残存**している（読み書きは続く）。
- store の `planKizunaDay` / `markKizunaFired` アクションは**どこからも呼ばれていない死コード**。クールダウンは `lastFiredRef`（メモリ上）で十分なため、これらの列は将来のマイグレーションで削除候補。

---

## 既知の課題・技術的負債

確認できた改善候補です。

1. **stamina は設計上エフェメラル（DB化しない）**
   HuntClient のスタミナはゲーム再開で全回復する per-session 値のため、意図的に Zustand のみ（DB 化しない）。

2. **初回デプロイ時の一度きりリセット**
   coins/inventory/kizuna の DB ハイドレートにより、既存 localStorage のゲーム内在庫・絆進捗は初回ロードで一度だけ DB 値（初期は空）に揃う＝実質リセット。家庭内アプリのため許容。

### 対応済み（2026-06-12）一本道化リフォーム

- ✅ **マップを6ピンに削減**：`HIDDEN_PIN_IDS`（[app/kids/config.ts](app/kids/config.ts)）で craft/farm/ranch/zoo/race/arcade/flow を非表示化（コード残置・復活可能）。PATHS もコアループの一本道に再設計。
- ✅ **物流センター → うんぱんミッション**：エサ配送ミニゲーム（`LogisticsClient.tsx`・875行・唯一の `@ts-nocheck`）を削除し、親が Bank で登録する LOGISTICS カテゴリクエスト（現実のモノの運搬）の申請画面（`LogisticsMissionsClient.tsx`）へ全面置換。**これによりコードベースから `@ts-nocheck` が消滅**。
- ✅ **LOGISTICS 承認でレア罠付与**：`approveQuest` がコインに加えて `cage_trap` を1個 UserTool に付与。レア罠の唯一の入手経路＝現実の運搬が最高価値の行動に。
- ✅ **クイズ必須化（QuizGate）**：罠設置の直前／アクティブ狩り出発の直前に全画面クイズ（[QuizGate](app/kids/[kidId]/QuizGate.tsx)）。出題は `getRandomQuizAnimal` ＋ `/api/quiz/generate`（Gemini→フォールバック→ローカル決め打ちの3段構え）。正解するまで進めない（別問題で再挑戦可）。
- ✅ **罠設置に1日3回上限**：`User.dailyTrapCount`/`lastTrapDate` 新設（マイグレーション `20260612010000_daily_trap_limit`）。上限到達＆回収待ち罠なしで「きょうのぶんは おしまい」全画面（[DayEndScreen](app/kids/[kidId]/DayEndScreen.tsx)）。アクティブ狩りも残り0なら入口で同画面。
- ✅ **クエスト申請に1日10回上限**：`submitQuest` で JST 日次カウント（`QUEST_DAILY_SUBMIT_LIMIT`）。
- ✅ **罠ショップ**：罠の入手経路断絶（クラフトは Zustand トイで UserTool 未接続）を解消。サファリ画面でコイン30枚→おとしあな購入（`buyTrap`）。「お手伝い→コイン→罠→図鑑」の原則ルートが機能するように。

### 対応済み（2026-05-31）

- ✅ **Gemini モデル既定を一元化＆常に最新へ**：版番号の散在（compose=`gemini-3-flash`／コード=`gemini-3.5-flash` 等）を解消。[lib/gemini.ts](lib/gemini.ts) の `DEFAULT_GEMINI_MODEL = "gemini-flash-latest"`（rolling 最新エイリアス）を唯一の既定とし、`GEMINI_MODEL` 環境変数は固定上書き用に。docker-compose は版を持たずパススルー。
- ✅ **アクティブ狩りに1日の捕獲回数制限を適用**：`recordActiveHuntCatch` に DB `dailyHuntCount`/`HUNT_DAILY_LIMIT`（JSTリセット）を組み込み、無制限の図鑑量産を防止（コイン付与はなし）。HuntClient に「のこり N/3」表示。
- ✅ **Kizuna（おたがいさま）を DB 化**：`User` に `kindnessCount`/`pendingReturns`/`kizunaBadgeCount`/`kizunaPlanDate`/`kizunaPlanKind`/`kizunaFiredDate` を追加し、`getKizuna`/`saveKizuna`＋ハイドレート/スナップショット同期で端末間・リロードに永続。
  - ※ その後、発火方式は「1日1回 予定→発火」から **「ページ移動毎 5%＋クールダウン」へ変更**（[おたがいさま（Kizuna）の発火](#おたがいさまkizuna-の発火) 参照）。`kizunaPlanDate`/`kizunaPlanKind`/`kizunaFiredDate` は同期のみ残るレガシー列となった。
- ✅ **`Material`/`UserMaterial` テーブルを削除**：レガシークラフト撤去でコード未使用になったため、マイグレーションでドロップ（seed も整理。`UserTool`＝パッシブ罠は温存）。
- ✅ **狩り世界観は現状維持で確定**：「狩り・武器」のコアサイクルをそのまま正とする（テイム化は別企画として保留）。
- ✅ **レガシークラフト系を撤去**：未使用の `features/craft/actions.ts`（`craftItem`）と `lib/recipes.ts` を削除し、クレーンの**死んだ `UserMaterial` への二重書き込みを廃止**（コイン消費のみ DB 確定）。クラフト UI（Zustand トイ）とパッシブ罠（`UserTool`）は温存。`Material`/`UserMaterial` テーブルは残存（ドロップは別途マイグレーション）。
- ✅ **型安全ゲートを復活**：`tsc` 139件を triage して **0 件**にし、`next.config.ts` の `ignoreBuildErrors` を撤廃。`npm run typecheck`（`tsc --noEmit`）を追加。Web Speech API 型は [types/speech.d.ts](types/speech.d.ts) で補完。未型付けの `LogisticsClient.tsx` のみ `@ts-nocheck` で暫定除外。
- ✅ **動物データの SSoT 統一**：デッドだった Zustand 動物状態（`animalsInYard`/`logisticsQueue`/`catchAnimal`/`sendToLogistics`/`shipTruck`/`medals`/`_stats`）を撤去し、**DB `CaughtAnimal` を唯一の動物ソース**に。アクティブ狩り（HuntClient）の捕獲も `recordActiveHuntCatch` で図鑑へ永続化（id不一致を解消、`eagle`/`frog` を図鑑に追加し計141種）。
- ✅ **`guild/` ルートを削除**：WorldMap の各ピンと重複し被リンクも無い孤立ハブだったため撤去。クエストの入口は `quests` に一本化。

### 対応済み（2026-05-30）

- ✅ **コインの二重管理を解消**：全コイン増減をトランザクション型サーバアクションに集約（牧場エサやりを `adjustCoins` 化、卒業報酬の `syncCoins` 漏れ修正）。ロード時は DB 値で必ずハイドレート。設計＝[docs/COIN_INVENTORY_REFACTOR.md](docs/COIN_INVENTORY_REFACTOR.md)。
- ✅ **在庫を DB 化**：`GameInventoryItem` 追加＋ `getInventory`/`saveInventory`＋ debounce スナップショット同期。
- ✅ `docker-compose.yml` の死んだ `OLLAMA_HOST` を削除（web / web-prod）。
- ✅ [lib/ai-guide.ts](lib/ai-guide.ts) の旧 Ollama コメントを Gemini に修正。
- ✅ [lib/gemini.ts](lib/gemini.ts) の既定モデルを廃止済み `gemini-1.5-flash` から最新へ統一（compose と一致）。
- ✅ 孤立していたレース実況 API（`app/api/race`・`app/api/race/generate`）と疎通スクリプト `scripts/test-race-api.mjs` を削除。陳腐化していたレースの E2E テストも除去。**Ollama 依存はコードベースから消滅**。

---

**参照**: [README.md](README.md)（起動方法・技術スタック・環境変数）
